import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, desc, inArray, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchRestockProducts } from '$lib/server/shopify/restock';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
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
		sessions: sessions.map((s) => ({ ...s, progress: progress.get(s.id) ?? { done: 0, total: 0, resumeIndex: 0 } }))
	};
};

export const actions: Actions = {
	start: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const [session] = await db.insert(inventorySessions).values({ storeId: params.storeId }).returning();

		let products: Awaited<ReturnType<typeof fetchRestockProducts>>;
		try {
			products = await fetchRestockProducts(client);
		} catch (e) {
			await db.delete(inventorySessions).where(eq(inventorySessions.id, session.id));
			return fail(422, { startError: e instanceof Error ? e.message : 'Failed to fetch products from Shopify' });
		}

		const items: (typeof inventoryItems.$inferInsert)[] = [];
		let position = 0;
		let variantPosition = 0;

		for (const product of products) {
			for (const variant of product.variants) {
				items.push({
					sessionId: session.id,
					productId: String(product.id),
					variantId: String(variant.id),
					productTitle: product.title,
					variantTitle: product.variants.length > 1 ? variant.title : null,
					sku: variant.sku || null,
					productImageUrl: product.imageUrl,
					variantImageUrl: variant.imageUrl,
					currentStock: Math.max(0, variant.inventoryQuantity),
					position,
					variantPosition: variantPosition++
				});
			}
			position++;
		}

		for (let i = 0; i < items.length; i += 100) {
			await db.insert(inventoryItems).values(items.slice(i, i + 100));
		}
		await db.update(inventorySessions).set({ totalProducts: position }).where(eq(inventorySessions.id, session.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'inventoryCount.session.start', {
				targetType: 'inventorySession', targetId: session.id, storeId: params.storeId, metadata: { totalProducts: position }
			});
		}

		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${session.id}/0`);
	},

	delete: async ({ request, params }) => {
		const fd = await request.formData();
		const sessionId = fd.get('sessionId')?.toString();
		if (!sessionId) return fail(400);

		const [session] = await db
			.select({ id: inventorySessions.id })
			.from(inventorySessions)
			.where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.storeId, params.storeId)));
		if (!session) return fail(404);

		await db.delete(inventoryItems).where(eq(inventoryItems.sessionId, sessionId));
		await db.delete(inventorySessions).where(eq(inventorySessions.id, sessionId));

		return { deleted: true };
	}
};
