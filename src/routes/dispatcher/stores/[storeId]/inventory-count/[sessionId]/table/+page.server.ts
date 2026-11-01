import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchLiveStock } from '$lib/server/shopify/restock';
import { getInventorySession, saveCounts } from '$lib/server/inventory-session';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { store, auditSession: session } = await getInventorySession(locals.session, params.storeId, params.sessionId);
	if (session.appliedAt) redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);

	const items = await db
		.select({
			id: inventoryItems.id,
			position: inventoryItems.position,
			variantId: inventoryItems.variantId,
			productTitle: inventoryItems.productTitle,
			variantTitle: inventoryItems.variantTitle,
			sku: inventoryItems.sku,
			productImageUrl: inventoryItems.productImageUrl,
			variantImageUrl: inventoryItems.variantImageUrl,
			currentStock: inventoryItems.currentStock,
			newStock: inventoryItems.newStock,
			skipped: inventoryItems.skipped
		})
		.from(inventoryItems)
		.where(eq(inventoryItems.sessionId, params.sessionId))
		.orderBy(asc(inventoryItems.position), asc(inventoryItems.variantPosition));

	// Live on_hand for uncounted rows, streamed so the table paints first.
	const live: Promise<{ onHand: Record<string, number> | null; error: string | null }> = fetchLiveStock(
		getShopifyClient(store),
		items.map((i) => i.variantId)
	)
		.then((map) => ({ onHand: Object.fromEntries([...map].map(([id, s]) => [id, s.onHand])), error: null }))
		.catch((e) => ({ onHand: null, error: e instanceof Error ? e.message : 'Failed to load live stock from Shopify' }));

	return { session, items, live };
};

export const actions: Actions = {
	// One row: a number, '' (clear) or 'match'. Returns the stored count and
	// the on_hand it was diffed against, so the row shows the exact difference
	// that apply will push.
	saveRow: async ({ request, params, locals }) => {
		const { store } = await getInventorySession(locals.session, params.storeId, params.sessionId, { unlocked: true });
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		const raw = fd.get('value')?.toString() ?? '';
		const parsed = parseInt(raw, 10);
		if (!id || (raw !== '' && raw !== 'match' && (!Number.isFinite(parsed) || parsed < 0))) return fail(400);

		await saveCounts(store, params.sessionId, [{ id, value: raw === 'match' ? 'match' : raw === '' ? null : parsed }]);

		const [row] = await db
			.select({ newStock: inventoryItems.newStock, currentStock: inventoryItems.currentStock })
			.from(inventoryItems)
			.where(and(eq(inventoryItems.id, id), eq(inventoryItems.sessionId, params.sessionId)));
		if (!row) return fail(404);
		return { success: true, ...row };
	},

	complete: async ({ params, locals }) => {
		await getInventorySession(locals.session, params.storeId, params.sessionId, { unlocked: true });
		await db.update(inventorySessions).set({ completedAt: new Date() }).where(eq(inventorySessions.id, params.sessionId));
		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);
	}
};
