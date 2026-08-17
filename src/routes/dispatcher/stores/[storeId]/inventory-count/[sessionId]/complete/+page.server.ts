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

	// Products still marked skipped (not yet recounted) — one row per product
	// position, not per variant, so the report doesn't repeat the same product
	// for each of its variants.
	const skippedByPosition = new Map<number, { position: number; productTitle: string; productImageUrl: string | null }>();
	for (const i of items) {
		if (i.skipped && i.newStock == null && !skippedByPosition.has(i.position)) {
			skippedByPosition.set(i.position, { position: i.position, productTitle: i.productTitle, productImageUrl: i.productImageUrl });
		}
	}
	const skippedProducts = [...skippedByPosition.values()].sort((a, b) => a.position - b.position);

	// Full list (not just checked/changed) — the Shopify-format export includes
	// every row so the admin gets the complete picture, with "On hand (new)" left
	// blank for anything not yet counted rather than omitting the row entirely.
	return { session, checkedItems, allItems: items, skippedProducts, storeName: currentStore.name };
};
