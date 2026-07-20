import { db } from '$lib/server/db';
import { variantCosts, inventoryCostEvents } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export interface RecordCostEventParams {
	storeId: string;
	variantId: string;
	sku: string | null;
	type: 'purchase' | 'damage' | 'sale';
	quantityDelta: number;
	// Only for purchases — the cost paid per unit. Damages/sales consume at
	// the existing running average instead, so their unit cost is derived.
	unitCost?: number;
	sourceType: 'purchase' | 'damage' | 'order';
	sourceId: string;
	shopifyAdjustmentStatus: 'success' | 'failed' | 'skipped';
	shopifyExpectedDelta: number;
	shopifyActualDelta: number | null;
	shopifyResponseRaw: unknown;
	createdBy: string;
}

export interface CostEventResult {
	eventId: string;
	unitCost: number;
	totalCost: number;
	qtyAfter: number;
	avgCostAfter: number;
}

// Appends one row to the append-only inventoryCostEvents ledger and updates
// the variantCosts cache to match. variantCosts is always re-derivable by
// folding the ledger from scratch — if it ever drifts, rebuild from here.
export async function recordCostEvent(params: RecordCostEventParams): Promise<CostEventResult> {
	const existing = await db.query.variantCosts.findFirst({
		where: and(eq(variantCosts.storeId, params.storeId), eq(variantCosts.variantId, params.variantId))
	});

	const qtyBefore = existing?.quantityOnHand ?? 0;
	const avgCostBefore = existing ? parseFloat(existing.avgCost) : 0;

	const qtyAfter = qtyBefore + params.quantityDelta;

	let unitCost: number;
	let avgCostAfter: number;

	if (params.type === 'purchase') {
		unitCost = params.unitCost ?? 0;
		const totalCostBefore = avgCostBefore * qtyBefore;
		const totalCostAdded = unitCost * params.quantityDelta;
		avgCostAfter = qtyAfter > 0 ? (totalCostBefore + totalCostAdded) / qtyAfter : unitCost;
	} else {
		// Damage/sale consumes existing stock at the current running average —
		// removing units at that average doesn't change the average itself.
		unitCost = avgCostBefore;
		avgCostAfter = avgCostBefore;
	}

	const totalCost = unitCost * Math.abs(params.quantityDelta);

	const [event] = await db
		.insert(inventoryCostEvents)
		.values({
			storeId: params.storeId,
			variantId: params.variantId,
			sku: params.sku,
			type: params.type,
			quantityDelta: params.quantityDelta,
			unitCost: unitCost.toFixed(4),
			totalCost: totalCost.toFixed(2),
			qtyBefore,
			avgCostBefore: avgCostBefore.toFixed(4),
			qtyAfter,
			avgCostAfter: avgCostAfter.toFixed(4),
			sourceType: params.sourceType,
			sourceId: params.sourceId,
			shopifyAdjustmentStatus: params.shopifyAdjustmentStatus,
			shopifyExpectedDelta: params.shopifyExpectedDelta,
			shopifyActualDelta: params.shopifyActualDelta,
			shopifyResponseRaw: JSON.stringify(params.shopifyResponseRaw),
			createdBy: params.createdBy
		})
		.returning({ id: inventoryCostEvents.id });

	if (existing) {
		await db
			.update(variantCosts)
			.set({ quantityOnHand: qtyAfter, avgCost: avgCostAfter.toFixed(4), sku: params.sku, updatedAt: new Date() })
			.where(and(eq(variantCosts.storeId, params.storeId), eq(variantCosts.variantId, params.variantId)));
	} else {
		await db.insert(variantCosts).values({
			storeId: params.storeId,
			variantId: params.variantId,
			sku: params.sku,
			quantityOnHand: qtyAfter,
			avgCost: avgCostAfter.toFixed(4)
		});
	}

	return { eventId: event.id, unitCost, totalCost, qtyAfter, avgCostAfter };
}
