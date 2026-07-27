import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { purchases, purchaseBatches } from '$lib/server/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';
import { getVariantForMutation, adjustInventoryQuantity } from '$lib/server/shopify/restock';
import { recordCostEvent } from '$lib/server/accounting/cost-ledger';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const batches = await db
		.select()
		.from(purchaseBatches)
		.where(eq(purchaseBatches.storeId, params.storeId))
		.orderBy(desc(purchaseBatches.purchaseDate))
		.limit(30);

	const batchIds = batches.map((b) => b.id);
	const lines = batchIds.length
		? await db.select().from(purchases).where(inArray(purchases.batchId, batchIds))
		: [];

	const linesByBatch = new Map<string, typeof lines>();
	for (const line of lines) {
		if (!line.batchId) continue;
		const arr = linesByBatch.get(line.batchId) ?? [];
		arr.push(line);
		linesByBatch.set(line.batchId, arr);
	}

	return {
		batches: batches.map((b) => ({
			...b,
			lines: linesByBatch.get(b.id) ?? [],
			totalCost: (linesByBatch.get(b.id) ?? []).reduce((sum, l) => sum + parseFloat(l.totalCost), 0)
		}))
	};
};

export const actions: Actions = {
	// Edits a saved purchase line's quantity/cost. Rather than overwriting the
	// original ledger entry, this posts a reversal (undo the old qty @ old cost)
	// plus a fresh entry (apply the new qty @ new cost) — the ledger stays
	// append-only, and Shopify only gets sent the net difference in one call.
	editLine: async ({ request, params, locals }) => {
		if (!locals.session) return fail(401);

		const fd = await request.formData();
		const lineId = fd.get('id') as string;
		const newQuantity = parseInt(fd.get('quantity') as string, 10);
		const newUnitCost = parseFloat(fd.get('unitCost') as string);

		if (!lineId || !newQuantity || newQuantity <= 0 || isNaN(newUnitCost) || newUnitCost < 0) {
			return fail(400, { error: 'Enter a valid quantity and unit cost' });
		}

		const line = await db.query.purchases.findFirst({
			where: and(eq(purchases.id, lineId), eq(purchases.storeId, params.storeId))
		});
		if (!line) return fail(404);

		const oldQuantity = line.quantity;
		const oldUnitCost = parseFloat(line.unitCost);
		const deltaQty = newQuantity - oldQuantity;

		const store = await getAuthorizedAccountingStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		let shopifyStatus: 'success' | 'failed' | 'skipped' = 'skipped';
		let actualDelta: number | null = null;
		let raw: unknown = null;

		if (deltaQty !== 0) {
			const target = await getVariantForMutation(client, line.variantId);
			if (!target) {
				return fail(422, { error: 'Could not resolve that variant in Shopify — it may have been deleted' });
			}
			const adjustResult = await adjustInventoryQuantity(client, {
				inventoryItemId: target.inventoryItemId,
				locationId: target.locationId,
				delta: deltaQty,
				reason: 'restock'
			});
			shopifyStatus = adjustResult.success ? 'success' : 'failed';
			actualDelta = adjustResult.actualDelta;
			raw = adjustResult.raw;
		}

		await recordCostEvent({
			storeId: params.storeId,
			variantId: line.variantId,
			sku: line.sku,
			type: 'purchase',
			quantityDelta: -oldQuantity,
			unitCost: oldUnitCost,
			sourceType: 'purchase',
			sourceId: `${lineId}:edit-reverse`,
			shopifyAdjustmentStatus: 'skipped',
			shopifyExpectedDelta: 0,
			shopifyActualDelta: null,
			shopifyResponseRaw: null,
			createdBy: locals.session.userId
		});
		const ledger = await recordCostEvent({
			storeId: params.storeId,
			variantId: line.variantId,
			sku: line.sku,
			type: 'purchase',
			quantityDelta: newQuantity,
			unitCost: newUnitCost,
			sourceType: 'purchase',
			sourceId: `${lineId}:edit-apply`,
			shopifyAdjustmentStatus: shopifyStatus,
			shopifyExpectedDelta: deltaQty,
			shopifyActualDelta: actualDelta,
			shopifyResponseRaw: raw,
			createdBy: locals.session.userId
		});

		await db
			.update(purchases)
			.set({
				quantity: newQuantity,
				unitCost: newUnitCost.toFixed(4),
				totalCost: (newQuantity * newUnitCost).toFixed(2),
				shopifyAdjustmentStatus: shopifyStatus === 'failed' ? 'failed' : 'success'
			})
			.where(eq(purchases.id, lineId));

		await logAudit(locals.session.userId, 'accounting', 'purchase.edit', {
			targetType: 'purchase',
			targetId: lineId,
			storeId: params.storeId,
			metadata: { oldQuantity, oldUnitCost, newQuantity, newUnitCost, costEventId: ledger.eventId }
		});

		if (shopifyStatus === 'failed') {
			return { success: true, warning: `Saved, but the Shopify stock update failed — check the audit log and adjust manually if needed.` };
		}

		return { success: true };
	}
};
