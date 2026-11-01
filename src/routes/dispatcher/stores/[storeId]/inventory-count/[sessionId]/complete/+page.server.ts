import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { inventoryItems } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getInventorySession } from '$lib/server/inventory-session';
import { isBigDifference } from '$lib/inventory-audit';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const [{ currentStore }, { auditSession: session }] = await Promise.all([
		parent(),
		getInventorySession(locals.session, params.storeId, params.sessionId)
	]);

	const items = await db
		.select()
		.from(inventoryItems)
		.where(eq(inventoryItems.sessionId, params.sessionId))
		.orderBy(asc(inventoryItems.position), asc(inventoryItems.variantPosition));

	// Biggest differences first — those are the ones worth eyeballing before
	// applying. `big` flags likely typos / miscounts for a recount.
	const checkedItems = items
		.filter((i) => i.newStock != null && i.newStock !== i.currentStock)
		.map((i) => ({ ...i, big: isBigDifference(i.currentStock, i.newStock!) }))
		.sort((a, b) => Math.abs(b.newStock! - b.currentStock) - Math.abs(a.newStock! - a.currentStock));

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

	const counted = items.filter((i) => i.newStock != null).length;
	const summary = {
		variants: items.length,
		counted,
		matched: counted - checkedItems.length,
		different: checkedItems.length,
		notCounted: items.length - counted,
		// Share of counted variants where the shelf matched Shopify.
		accuracy: counted === 0 ? null : Math.round(((counted - checkedItems.length) / counted) * 100)
	};

	return { session, checkedItems, skippedProducts, summary, storeName: currentStore.name };
};
