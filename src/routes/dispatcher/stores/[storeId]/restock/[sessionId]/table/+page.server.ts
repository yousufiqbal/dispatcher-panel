import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { restockSessions, restockItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchLiveStock } from '$lib/server/shopify/restock';
import { getRestockSession } from '$lib/server/restock-session';
import type { LiveStock } from '$lib/restock-calc';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { store, restockSession: session, lead } = await getRestockSession(locals.session, params.storeId, params.sessionId);

	const items = await db
		.select({
			id: restockItems.id,
			position: restockItems.position,
			variantId: restockItems.variantId,
			productTitle: restockItems.productTitle,
			variantTitle: restockItems.variantTitle,
			sku: restockItems.sku,
			productImageUrl: restockItems.productImageUrl,
			variantImageUrl: restockItems.variantImageUrl,
			sales30: restockItems.sales30,
			sales60: restockItems.sales60,
			sales90: restockItems.sales90,
			actualRestock: restockItems.actualRestock,
			restockMode: restockItems.restockMode
		})
		.from(restockItems)
		.where(eq(restockItems.sessionId, params.sessionId))
		.orderBy(asc(restockItems.position), asc(restockItems.variantPosition), asc(restockItems.id));

	// Streamed rather than awaited: the table renders from the DB rows right
	// away and fills stock / recommendations in when Shopify answers.
	const live: Promise<{ stock: Record<string, LiveStock> | null; error: string | null }> = fetchLiveStock(
		getShopifyClient(store),
		items.map((i) => i.variantId)
	)
		.then((map) => ({ stock: Object.fromEntries(map), error: null }))
		.catch((e) => ({ stock: null, error: e instanceof Error ? e.message : 'Failed to load live stock from Shopify' }));

	return { session, lead, items, live };
};

export const actions: Actions = {
	saveRow: async ({ request, params, locals }) => {
		await getRestockSession(locals.session, params.storeId, params.sessionId);
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		const raw = fd.get('qty')?.toString() ?? '';
		const parsed = parseInt(raw, 10);
		if (!id || (raw !== '' && (!Number.isFinite(parsed) || parsed < 0))) return fail(400);
		const qty = raw === '' ? null : parsed;
		const mode = fd.get('mode');

		const updated = await db
			.update(restockItems)
			.set({ actualRestock: qty, restockMode: qty && (mode === 'air' || mode === 'sea') ? mode : null })
			.where(and(eq(restockItems.id, id), eq(restockItems.sessionId, params.sessionId)))
			.returning({ id: restockItems.id });
		if (updated.length === 0) return fail(404);
		return { success: true };
	},

	complete: async ({ params, locals }) => {
		await getRestockSession(locals.session, params.storeId, params.sessionId);
		await db.update(restockSessions).set({ completedAt: new Date() }).where(eq(restockSessions.id, params.sessionId));
		redirect(303, `/dispatcher/stores/${params.storeId}/restock/${params.sessionId}/complete`);
	}
};
