import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { restockItems } from '$lib/server/db/schema';
import { eq, and, asc, gt } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchLiveStock } from '$lib/server/shopify/restock';
import { getRestockSession } from '$lib/server/restock-session';
import type { LiveStock } from '$lib/restock-calc';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const [{ currentStore }, { store, restockSession: session }] = await Promise.all([
		parent(),
		getRestockSession(locals.session, params.storeId, params.sessionId)
	]);

	const restockList = await db
		.select()
		.from(restockItems)
		.where(and(eq(restockItems.sessionId, params.sessionId), gt(restockItems.actualRestock, 0)))
		.orderBy(asc(restockItems.position), asc(restockItems.variantPosition), asc(restockItems.id));

	// Live stock streamed in after first paint — the list may be acted on days
	// after the session, so what's on hand / on the way now is what matters.
	const live: Promise<{ stock: Record<string, LiveStock> | null; error: string | null }> = fetchLiveStock(
		getShopifyClient(store),
		restockList.map((i) => i.variantId)
	)
		.then((map) => ({ stock: Object.fromEntries(map), error: null }))
		.catch((e) => ({ stock: null, error: e instanceof Error ? e.message : 'Failed to load live stock from Shopify' }));

	return { session, restockList, storeName: currentStore.name, live };
};

export const actions: Actions = {
	toggleOrdered: async ({ request, params, locals }) => {
		await getRestockSession(locals.session, params.storeId, params.sessionId);
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400);

		const [item] = await db
			.select({ orderedAt: restockItems.orderedAt })
			.from(restockItems)
			.where(and(eq(restockItems.id, id), eq(restockItems.sessionId, params.sessionId)));
		if (!item) return fail(404);

		await db.update(restockItems).set({ orderedAt: item.orderedAt ? null : new Date() }).where(eq(restockItems.id, id));
		return { success: true };
	},

	// Restock qty can be revised on the list itself — e.g. after seeing live
	// stock has moved since the session was built.
	updateQty: async ({ request, params, locals }) => {
		await getRestockSession(locals.session, params.storeId, params.sessionId);
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		const qty = parseInt(fd.get('qty')?.toString() ?? '', 10);
		if (!id || !Number.isFinite(qty) || qty < 0) return fail(400);

		const updated = await db
			.update(restockItems)
			.set({ actualRestock: qty })
			.where(and(eq(restockItems.id, id), eq(restockItems.sessionId, params.sessionId)))
			.returning({ id: restockItems.id });
		if (updated.length === 0) return fail(404);
		return { success: true };
	}
};
