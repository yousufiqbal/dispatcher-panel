import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchLiveStock } from '$lib/server/shopify/restock';
import { getInventorySession, saveCounts, type CountEntry } from '$lib/server/inventory-session';

export const load: PageServerLoad = async ({ params, locals }) => {
	const index = parseInt(params.productIndex, 10);
	if (isNaN(index) || index < 0) redirect(303, `../${params.sessionId}/0`);

	const [{ store, auditSession: session }, variants] = await Promise.all([
		getInventorySession(locals.session, params.storeId, params.sessionId),
		db
			.select()
			.from(inventoryItems)
			.where(and(eq(inventoryItems.sessionId, params.sessionId), eq(inventoryItems.position, index)))
			.orderBy(asc(inventoryItems.variantPosition))
	]);

	// Once pushed to Shopify the counts are frozen — send them to the report.
	if (session.appliedAt) redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);

	const totalProducts = session.totalProducts;
	if (index >= totalProducts || variants.length === 0) {
		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);
	}

	// What Shopify says is on the shelf right now. Uncounted variants show this;
	// counted ones show the on_hand they were diffed against at count time.
	let live: Map<string, { onHand: number }> | null = null;
	let stockError: string | null = null;
	try {
		live = await fetchLiveStock(getShopifyClient(store), variants.map((v) => v.variantId));
	} catch (e) {
		stockError = e instanceof Error ? e.message : 'Failed to load live stock from Shopify';
	}

	return {
		session,
		stockError,
		variants: variants.map((v) => ({
			...v,
			systemStock: v.newStock != null ? v.currentStock : live?.get(v.variantId)?.onHand ?? null
		})),
		productTitle: variants[0].productTitle,
		productImageUrl: variants[0].productImageUrl,
		index,
		totalProducts,
		prevIndex: index > 0 ? index - 1 : null,
		nextIndex: index < totalProducts - 1 ? index + 1 : null
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const { store } = await getInventorySession(locals.session, params.storeId, params.sessionId, { unlocked: true });
		const fd = await request.formData();
		const entries: CountEntry[] = [];
		for (const [key, raw] of fd.entries()) {
			if (!key.startsWith('newStock_')) continue;
			const value = String(raw);
			const parsed = parseInt(value, 10);
			entries.push({
				id: key.slice('newStock_'.length),
				value: value === 'match' ? 'match' : value === '' || !Number.isFinite(parsed) ? null : Math.max(0, parsed)
			});
		}
		await saveCounts(store, params.sessionId, entries);
		return { success: true };
	},

	// Distinct from Next — Next records blanks as "matches Shopify" and marks
	// the product done, which would silently record "unchanged" for a product
	// the dispatcher couldn't actually find (e.g. hidden from view). Skip leaves
	// newStock untouched and flags every variant at this position as skipped,
	// so it's visible separately and can be jumped back to for a real recount.
	skip: async ({ params, locals }) => {
		await getInventorySession(locals.session, params.storeId, params.sessionId, { unlocked: true });
		const index = parseInt(params.productIndex, 10);
		await db
			.update(inventoryItems)
			.set({ skipped: true })
			.where(and(eq(inventoryItems.sessionId, params.sessionId), eq(inventoryItems.position, index)));
		return { success: true };
	},

	complete: async ({ params, locals }) => {
		await getInventorySession(locals.session, params.storeId, params.sessionId, { unlocked: true });
		await db.update(inventorySessions).set({ completedAt: new Date() }).where(eq(inventorySessions.id, params.sessionId));
		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);
	}
};
