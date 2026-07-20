import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { restockSessions, restockItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { currentStore } = await parent();

	const [session] = await db
		.select()
		.from(restockSessions)
		.where(and(eq(restockSessions.id, params.sessionId), eq(restockSessions.storeId, params.storeId)));
	if (!session) error(404, 'Session not found');

	const items = await db
		.select()
		.from(restockItems)
		.where(eq(restockItems.sessionId, params.sessionId))
		.orderBy(asc(restockItems.position), asc(restockItems.variantPosition), asc(restockItems.id));

	const restockList = items.filter((i) => (i.actualRestock ?? 0) > 0);

	return { session, restockList, storeName: currentStore.name };
};

export const actions: Actions = {
	toggleOrdered: async ({ request }) => {
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400);

		const [item] = await db.select({ orderedAt: restockItems.orderedAt }).from(restockItems).where(eq(restockItems.id, id));
		if (!item) return fail(404);

		await db.update(restockItems).set({ orderedAt: item.orderedAt ? null : new Date() }).where(eq(restockItems.id, id));
		return { success: true };
	}
};
