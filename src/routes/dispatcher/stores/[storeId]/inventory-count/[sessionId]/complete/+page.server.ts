import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, asc, isNull, isNotNull, inArray } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getVariantsForMutation, adjustInventoryQuantities } from '$lib/server/shopify/restock';
import { logAudit } from '$lib/server/audit';

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

	return { session, checkedItems, skippedProducts, storeName: currentStore.name };
};

// Shopify's inventoryAdjustQuantities is all-or-nothing per call. Small
// batches keep one bad variant from blocking the whole session.
const APPLY_BATCH = 25;

export const actions: Actions = {
	// Pushes each counted variant's delta (newStock − currentStock at count
	// time) to Shopify as an on_hand adjustment. Deltas, not absolutes, so
	// orders fulfilled between the count and this click aren't undone. Items
	// already applied are skipped; failed ones stay retryable.
	apply: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const [session] = await db
			.select()
			.from(inventorySessions)
			.where(and(eq(inventorySessions.id, params.sessionId), eq(inventorySessions.storeId, params.storeId)));
		if (!session) return fail(404, { error: 'Session not found' });

		const pending = (
			await db
				.select()
				.from(inventoryItems)
				.where(and(eq(inventoryItems.sessionId, params.sessionId), isNotNull(inventoryItems.newStock), isNull(inventoryItems.appliedAt)))
		).filter((i) => i.newStock !== i.currentStock);
		if (pending.length === 0) return { applied: 0, failed: 0 };

		const variants = await getVariantsForMutation(client, pending.map((i) => i.variantId));
		const now = new Date();
		const applied: typeof pending = [];
		const failed: { item: (typeof pending)[number]; error: string }[] = [];

		const resolvable = pending.filter((i) => {
			if (variants.has(i.variantId)) return true;
			failed.push({ item: i, error: 'Variant not found in Shopify (deleted?)' });
			return false;
		});

		for (let i = 0; i < resolvable.length; i += APPLY_BATCH) {
			const batch = resolvable.slice(i, i + APPLY_BATCH);
			const result = await adjustInventoryQuantities(client, {
				reason: 'cycle_count_available',
				changes: batch.map((item) => {
					const v = variants.get(item.variantId)!;
					return { inventoryItemId: v.inventoryItemId, locationId: v.locationId, delta: item.newStock! - item.currentStock };
				})
			});
			if (result.success) applied.push(...batch);
			else for (const item of batch) failed.push({ item, error: result.error ?? 'Unknown error' });
		}

		if (applied.length > 0) {
			if (!session.appliedAt) {
				await db
					.update(inventorySessions)
					.set({ appliedAt: now, appliedBy: locals.session?.userId ?? null, completedAt: session.completedAt ?? now })
					.where(eq(inventorySessions.id, session.id));
			}
			await db
				.update(inventoryItems)
				.set({ appliedAt: now, applyError: null })
				.where(inArray(inventoryItems.id, applied.map((i) => i.id)));
			// appliedDelta differs per row — one update each.
			for (const item of applied) {
				await db.update(inventoryItems).set({ appliedDelta: item.newStock! - item.currentStock }).where(eq(inventoryItems.id, item.id));
			}
		}
		for (const f of failed) {
			await db.update(inventoryItems).set({ applyError: f.error }).where(eq(inventoryItems.id, f.item.id));
		}

		const row = (i: (typeof pending)[number]) => ({
			product: i.productTitle,
			variant: i.variantTitle,
			sku: i.sku,
			systemStock: i.currentStock,
			counted: i.newStock,
			delta: i.newStock! - i.currentStock
		});
		if (locals.session) {
			await logAudit(locals.session.userId, locals.session.role, 'inventory.count.apply', {
				targetType: 'inventorySession',
				targetId: params.sessionId,
				storeId: params.storeId,
				metadata: {
					store: store.name,
					sessionStartedAt: session.startedAt,
					appliedCount: applied.length,
					failedCount: failed.length,
					netUnits: applied.reduce((s, i) => s + (i.newStock! - i.currentStock), 0),
					applied: applied.map(row),
					failed: failed.map((f) => ({ ...row(f.item), error: f.error }))
				}
			});
		}

		return { applied: applied.length, failed: failed.length };
	}
};
