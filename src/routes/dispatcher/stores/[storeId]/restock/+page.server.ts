import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores, restockSessions, restockItems } from '$lib/server/db/schema';
import { eq, and, desc, inArray, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchRestockProducts, fetchVariantSales, calcRecommendation } from '$lib/server/shopify/restock';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const sessions = await db
		.select()
		.from(restockSessions)
		.where(eq(restockSessions.storeId, params.storeId))
		.orderBy(desc(restockSessions.startedAt))
		.limit(10);

	// Per-session progress: done/total products + resume index (first unfinished)
	const ids = sessions.map((s) => s.id);
	const progress = new Map<string, { done: number; total: number; resumeIndex: number }>();

	if (ids.length) {
		const rows = await db
			.select({ sessionId: restockItems.sessionId, position: restockItems.position, actualRestock: restockItems.actualRestock })
			.from(restockItems)
			.where(inArray(restockItems.sessionId, ids))
			.orderBy(asc(restockItems.position));

		const bySession = new Map<string, Map<number, boolean>>();
		for (const r of rows) {
			let posMap = bySession.get(r.sessionId);
			if (!posMap) bySession.set(r.sessionId, (posMap = new Map()));
			posMap.set(r.position, (posMap.get(r.position) ?? false) || r.actualRestock != null);
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
		const [fullStore] = await db.select().from(stores).where(eq(stores.id, params.storeId));
		if (!fullStore) error(404, 'Store not found');

		const client = getShopifyClient(store);
		const [session] = await db.insert(restockSessions).values({ storeId: params.storeId }).returning();

		let products: Awaited<ReturnType<typeof fetchRestockProducts>>;
		let salesMap: Awaited<ReturnType<typeof fetchVariantSales>>;
		try {
			products = await fetchRestockProducts(client);
			const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
			salesMap = await fetchVariantSales(client, variantIds);
		} catch (e) {
			await db.delete(restockSessions).where(eq(restockSessions.id, session.id));
			return fail(422, { startError: e instanceof Error ? e.message : 'Failed to fetch products from Shopify' });
		}

		const items: (typeof restockItems.$inferInsert)[] = [];
		let position = 0;
		let variantPosition = 0;

		for (const product of products) {
			for (const variant of product.variants) {
				const sales = salesMap.get(variant.id) ?? { s30: 0, s60: 0, s90: 0 };
				const currentStock = Math.max(0, variant.inventoryQuantity);
				items.push({
					sessionId: session.id,
					productId: String(product.id),
					variantId: String(variant.id),
					productTitle: product.title,
					variantTitle: product.variants.length > 1 ? variant.title : null,
					sku: variant.sku || null,
					productImageUrl: product.imageUrl,
					variantImageUrl: variant.imageUrl,
					sales30: sales.s30,
					sales60: sales.s60,
					sales90: sales.s90,
					currentStock,
					recAir: calcRecommendation(sales.s30, currentStock, fullStore.airLeadDays),
					recSea: calcRecommendation(sales.s30, currentStock, fullStore.seaLeadDays),
					position,
					variantPosition: variantPosition++
				});
			}
			position++;
		}

		for (let i = 0; i < items.length; i += 100) {
			await db.insert(restockItems).values(items.slice(i, i + 100));
		}
		await db.update(restockSessions).set({ totalProducts: position }).where(eq(restockSessions.id, session.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'restock.session.start', {
				targetType: 'restockSession', targetId: session.id, storeId: params.storeId, metadata: { totalProducts: position }
			});
		}

		redirect(303, `/dispatcher/stores/${params.storeId}/restock/${session.id}/0`);
	},

	delete: async ({ request, params }) => {
		const fd = await request.formData();
		const sessionId = fd.get('sessionId')?.toString();
		if (!sessionId) return fail(400);

		const [session] = await db
			.select({ id: restockSessions.id })
			.from(restockSessions)
			.where(and(eq(restockSessions.id, sessionId), eq(restockSessions.storeId, params.storeId)));
		if (!session) return fail(404);

		await db.delete(restockItems).where(eq(restockItems.sessionId, sessionId));
		await db.delete(restockSessions).where(eq(restockSessions.id, sessionId));

		return { deleted: true };
	}
};
