import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const index = parseInt(params.productIndex, 10);
	if (isNaN(index) || index < 0) redirect(303, `../${params.sessionId}/0`);

	const [[session], variants] = await Promise.all([
		db
			.select()
			.from(inventorySessions)
			.where(and(eq(inventorySessions.id, params.sessionId), eq(inventorySessions.storeId, params.storeId))),
		db
			.select()
			.from(inventoryItems)
			.where(and(eq(inventoryItems.sessionId, params.sessionId), eq(inventoryItems.position, index)))
			.orderBy(asc(inventoryItems.variantPosition))
	]);

	if (!session) error(404, 'Session not found');
	// Once pushed to Shopify the counts are frozen — send them to the report.
	if (session.appliedAt) redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);

	const totalProducts = session.totalProducts;
	if (index >= totalProducts || variants.length === 0) {
		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);
	}

	return {
		session,
		variants,
		productTitle: variants[0].productTitle,
		productImageUrl: variants[0].productImageUrl,
		index,
		totalProducts,
		prevIndex: index > 0 ? index - 1 : null,
		nextIndex: index < totalProducts - 1 ? index + 1 : null
	};
};

async function assertUnlocked(storeId: string, sessionId: string) {
	const [session] = await db
		.select({ appliedAt: inventorySessions.appliedAt })
		.from(inventorySessions)
		.where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.storeId, storeId)));
	if (!session) error(404, 'Session not found');
	if (session.appliedAt) error(403, 'This session was applied to Shopify and can no longer be edited.');
}

export const actions: Actions = {
	save: async ({ request, params }) => {
		await assertUnlocked(params.storeId, params.sessionId);
		const fd = await request.formData();
		const updates: Promise<unknown>[] = [];
		for (const [key, value] of fd.entries()) {
			if (key.startsWith('newStock_')) {
				const id = key.replace('newStock_', '');
				const newStock = value === '' ? null : parseInt(value as string, 10);
				// A real count coming in means this variant has been (re)counted —
				// clear any earlier "skipped" mark so it stops showing up as skipped.
				updates.push(db.update(inventoryItems).set({ newStock, skipped: newStock == null ? undefined : false }).where(eq(inventoryItems.id, id)));
			}
		}
		await Promise.all(updates);
		return { success: true };
	},

	// Distinct from Next — Next fills blanks with the current stock and marks
	// the product done, which would silently record "unchanged" for a product
	// the dispatcher couldn't actually find (e.g. hidden from view). Skip leaves
	// newStock untouched and flags every variant at this position as skipped,
	// so it's visible separately and can be jumped back to for a real recount.
	skip: async ({ params }) => {
		await assertUnlocked(params.storeId, params.sessionId);
		const index = parseInt(params.productIndex, 10);
		await db
			.update(inventoryItems)
			.set({ skipped: true })
			.where(and(eq(inventoryItems.sessionId, params.sessionId), eq(inventoryItems.position, index)));
		return { success: true };
	},

	complete: async ({ params }) => {
		await assertUnlocked(params.storeId, params.sessionId);
		await db.update(inventorySessions).set({ completedAt: new Date() }).where(eq(inventorySessions.id, params.sessionId));
		redirect(303, `/dispatcher/stores/${params.storeId}/inventory-count/${params.sessionId}/complete`);
	}
};
