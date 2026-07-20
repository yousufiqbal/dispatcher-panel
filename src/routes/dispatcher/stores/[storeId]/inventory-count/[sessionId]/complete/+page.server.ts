import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { currentStore } = await parent();

	const [session] = await db
		.select()
		.from(inventorySessions)
		.where(and(eq(inventorySessions.id, params.sessionId), eq(inventorySessions.storeId, params.storeId)));
	if (!session) error(404, 'Session not found');

	const items = await db
		.select()
		.from(inventoryItems)
		.where(eq(inventoryItems.sessionId, params.sessionId))
		.orderBy(asc(inventoryItems.position), asc(inventoryItems.variantPosition));

	const checkedItems = items.filter((i) => i.newStock != null && i.newStock !== i.currentStock);

	return { session, checkedItems, storeName: currentStore.name };
};
