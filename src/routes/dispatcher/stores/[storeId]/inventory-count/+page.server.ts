import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, desc, inArray, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchRestockProducts, fetchLiveStock } from '$lib/server/shopify/restock';
import { listAllCollections } from '$lib/server/shopify/products';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params, locals }) => {
	// For the "count one collection" picker — streamed so the session list
	// doesn't wait on Shopify.
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const collections = listAllCollections(getShopifyClient(store))
		.then((list) => list.map((c) => ({ id: c.id.split('/').pop()!, title: c.title })))
		.catch(() => []);

	const sessions = await db
		.select()
		.from(inventorySessions)
		.where(eq(inventorySessions.storeId, params.storeId))
		.orderBy(desc(inventorySessions.startedAt))
		.limit(10);

	const ids = sessions.map((s) => s.id);
	const progress = new Map<string, { done: number; total: number; resumeIndex: number }>();

	if (ids.length) {
		const rows = await db
			.select({ sessionId: inventoryItems.sessionId, position: inventoryItems.position, newStock: inventoryItems.newStock })
			.from(inventoryItems)
			.where(inArray(inventoryItems.sessionId, ids))
			.orderBy(asc(inventoryItems.position));

		const bySession = new Map<string, Map<number, boolean>>();
		for (const r of rows) {
			let posMap = bySession.get(r.sessionId);
			if (!posMap) bySession.set(r.sessionId, (posMap = new Map()));
			posMap.set(r.position, (posMap.get(r.position) ?? false) || r.newStock != null);
		}

		for (const [sid, posMap] of bySession) {
			const positions = [...posMap.keys()].sort((a, b) => a - b);
			let done = 0;
			let resumeIndex = -1;
			positions.forEach((pos, i) => {
				if (posMap.get(pos)) done++;
				else if (resumeIndex === -1) resumeIndex = i;
			});
			progress.set(sid, { done, total: positions.length, resumeIndex: resumeIndex === -1 ? 0 : resumeIndex });
		}
	}

	return {
		sessions: sessions.map((s) => ({ ...s, progress: progress.get(s.id) ?? { done: 0, total: 0, resumeIndex: 0 } })),
		collections
	};
};

export const actions: Actions = {
	// Scope: whole active catalog, or one collection, optionally only variants
	// Shopify thinks are in stock — so a cycle count can cover one shelf area
	// instead of the full catalog every time.
	start: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const fd = await request.formData();
		const collectionId = fd.get('collectionId')?.toString().replace(/\D/g, '') || null;
		const collectionTitle = fd.get('collectionTitle')?.toString() || null;
		const inStockOnly = fd.get('inStockOnly') === 'on';
		const scopeLabel = [collectionId ? `Collection: ${collectionTitle ?? collectionId}` : null, inStockOnly ? 'in stock only' : null]
			.filter(Boolean)
			.join(' · ') || null;

		const [session] = await db.insert(inventorySessions).values({ storeId: params.storeId, scopeLabel }).returning();

		let products: Awaited<ReturnType<typeof fetchRestockProducts>>;
		let stock: Awaited<ReturnType<typeof fetchLiveStock>>;
		try {
			products = await fetchRestockProducts(client, collectionId ? `collection_id:${collectionId}` : undefined);
			stock = await fetchLiveStock(client, products.flatMap((p) => p.variants.map((v) => String(v.id))));
		} catch (e) {
			await db.delete(inventorySessions).where(eq(inventorySessions.id, session.id));
			return fail(422, { startError: e instanceof Error ? e.message : 'Failed to fetch products from Shopify' });
		}

		const items: (typeof inventoryItems.$inferInsert)[] = [];
		let position = 0;
		let variantPosition = 0;

		for (const product of products) {
			const variants = inStockOnly ? product.variants.filter((v) => (stock.get(String(v.id))?.onHand ?? 0) > 0) : product.variants;
			if (variants.length === 0) continue;
			for (const variant of variants) {
				items.push({
					sessionId: session.id,
					productId: String(product.id),
					variantId: String(variant.id),
					productTitle: product.title,
					variantTitle: product.variants.length > 1 ? variant.title : null,
					sku: variant.sku || null,
					productImageUrl: product.imageUrl,
					variantImageUrl: variant.imageUrl,
					// Placeholder only — replaced with live on_hand when counted.
					currentStock: stock.get(String(variant.id))?.onHand ?? 0,
					position,
					variantPosition: variantPosition++
				});
			}
			position++;
		}

		if (items.length === 0) {
			await db.delete(inventorySessions).where(eq(inventorySessions.id, session.id));
			return fail(422, { startError: 'No products match that scope.' });
		}

		for (let i = 0; i < items.length; i += 100) {
			await db.insert(inventoryItems).values(items.slice(i, i + 100));
		}
		await db.update(inventorySessions).set({ totalProducts: position }).where(eq(inventorySessions.id, session.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'inventoryCount.session.start', {
				targetType: 'inventorySession', targetId: session.id, storeId: params.storeId, metadata: { totalProducts: position, scope: scopeLabel }
			});
		}

		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${session.id}/0`);
	},

	delete: async ({ request, params, locals }) => {
		await getAuthorizedStore(locals.session, params.storeId);
		const fd = await request.formData();
		const sessionId = fd.get('sessionId')?.toString();
		if (!sessionId) return fail(400);

		const [session] = await db
			.select({ id: inventorySessions.id, appliedAt: inventorySessions.appliedAt })
			.from(inventorySessions)
			.where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.storeId, params.storeId)));
		if (!session) return fail(404);
		// Applied sessions are the permanent record of a Shopify adjustment.
		if (session.appliedAt) return fail(403, { error: 'This session was applied to Shopify and cannot be deleted.' });

		await db.delete(inventoryItems).where(eq(inventoryItems.sessionId, sessionId));
		await db.delete(inventorySessions).where(eq(inventorySessions.id, sessionId));

		return { deleted: true };
	}
};
