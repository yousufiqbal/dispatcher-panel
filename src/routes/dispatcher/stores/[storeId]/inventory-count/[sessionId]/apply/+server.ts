import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, isNull, isNotNull, inArray } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getVariantsForMutation, adjustInventoryQuantities } from '$lib/server/shopify/restock';
import { logAudit } from '$lib/server/audit';

// Shopify's inventoryAdjustQuantities is all-or-nothing per call, and the
// client drives one call per request so it can show real progress. Cap keeps
// a single bad variant from blocking too many neighbours.
const MAX_BATCH = 25;

// Sessions store variant ids as bare numbers; Shopify wants the GID form.
function toVariantGid(id: string): string {
	return id.startsWith('gid://') ? id : `gid://shopify/ProductVariant/${id}`;
}

export interface ApplyBatchResponse {
	applied: string[];
	failed: { id: string; error: string }[];
}

// Pushes one batch of counted variants to Shopify as on_hand deltas
// (newStock − currentStock at count time). Deltas, not absolutes, so orders
// fulfilled between the count and now aren't undone. Items already applied
// are ignored even if re-sent; failed ones stay retryable.
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	const body = (await request.json().catch(() => null)) as { itemIds?: unknown; batch?: unknown; totalBatches?: unknown } | null;
	const itemIds = Array.isArray(body?.itemIds) ? body!.itemIds.filter((x): x is string => typeof x === 'string').slice(0, MAX_BATCH) : [];
	if (itemIds.length === 0) throw error(400, 'No items');

	const [session] = await db
		.select()
		.from(inventorySessions)
		.where(and(eq(inventorySessions.id, params.sessionId), eq(inventorySessions.storeId, params.storeId)));
	if (!session) throw error(404, 'Session not found');

	const pending = (
		await db
			.select()
			.from(inventoryItems)
			.where(
				and(
					eq(inventoryItems.sessionId, params.sessionId),
					inArray(inventoryItems.id, itemIds),
					isNotNull(inventoryItems.newStock),
					isNull(inventoryItems.appliedAt)
				)
			)
	).filter((i) => i.newStock !== i.currentStock);
	if (pending.length === 0) return json({ applied: [], failed: [] } satisfies ApplyBatchResponse);

	const variants = await getVariantsForMutation(client, pending.map((i) => toVariantGid(i.variantId)));
	const failed: { item: (typeof pending)[number]; error: string }[] = [];
	const resolvable = pending.filter((i) => {
		if (variants.has(toVariantGid(i.variantId))) return true;
		failed.push({ item: i, error: 'Variant not found in Shopify (deleted?)' });
		return false;
	});

	let applied: typeof pending = [];
	if (resolvable.length > 0) {
		const result = await adjustInventoryQuantities(client, {
			reason: 'cycle_count_available',
			referenceDocumentUri: `gid://pro-shipper/InventoryCount/${session.id}`,
			changes: resolvable.map((item) => {
				const v = variants.get(toVariantGid(item.variantId))!;
				return { inventoryItemId: v.inventoryItemId, locationId: v.locationId, delta: item.newStock! - item.currentStock };
			})
		});
		if (result.success) applied = resolvable;
		else for (const item of resolvable) failed.push({ item, error: result.error ?? 'Unknown error' });
	}

	const now = new Date();
	if (applied.length > 0) {
		// First successful push freezes the session — it's now the record of a
		// real Shopify adjustment and must not be edited or deleted.
		if (!session.appliedAt) {
			await db
				.update(inventorySessions)
				.set({ appliedAt: now, appliedBy: locals.session?.userId ?? null, completedAt: session.completedAt ?? now })
				.where(eq(inventorySessions.id, session.id));
		}
		for (const item of applied) {
			await db
				.update(inventoryItems)
				.set({ appliedAt: now, appliedDelta: item.newStock! - item.currentStock, applyError: null })
				.where(eq(inventoryItems.id, item.id));
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
				batch: typeof body?.batch === 'number' ? body.batch : null,
				totalBatches: typeof body?.totalBatches === 'number' ? body.totalBatches : null,
				appliedCount: applied.length,
				failedCount: failed.length,
				netUnits: applied.reduce((s, i) => s + (i.newStock! - i.currentStock), 0),
				applied: applied.map(row),
				failed: failed.map((f) => ({ ...row(f.item), error: f.error }))
			}
		});
	}

	return json({ applied: applied.map((i) => i.id), failed: failed.map((f) => ({ id: f.item.id, error: f.error })) } satisfies ApplyBatchResponse);
};
