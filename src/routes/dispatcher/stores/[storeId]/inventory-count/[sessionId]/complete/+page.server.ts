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

	// Full list (not just checked/changed) — the Shopify-format export includes
	// every row so the admin gets the complete picture, with "On hand (new)" left
	// blank for anything not yet counted rather than omitting the row entirely.
	return { session, checkedItems, allItems: items, storeName: currentStore.name };
};
