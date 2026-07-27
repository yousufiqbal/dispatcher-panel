import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { purchases, purchaseBatches } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';
import { getVariantForMutation, adjustInventoryQuantity } from '$lib/server/shopify/restock';
import { recordCostEvent } from '$lib/server/accounting/cost-ledger';
import { logAudit } from '$lib/server/audit';

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.session) return fail(401);

		const fd = await request.formData();
		const supplier = (fd.get('supplier') as string)?.trim() || null;
		const purchaseDate = fd.get('purchaseDate') as string;
		const note = (fd.get('note') as string)?.trim() || null;

		const variantIds = fd.getAll('variantId') as string[];
		const productIds = fd.getAll('productId') as string[];
		const productTitles = fd.getAll('productTitle') as string[];
		const variantTitles = fd.getAll('variantTitle') as string[];
		const skus = fd.getAll('sku') as string[];
		const quantities = (fd.getAll('quantity') as string[]).map((q) => parseInt(q, 10));
		const unitCosts = (fd.getAll('unitCost') as string[]).map((c) => parseFloat(c));

		if (!purchaseDate || variantIds.length === 0) {
			return fail(400, { error: 'Add at least one line item and a purchase date' });
		}
		for (let i = 0; i < variantIds.length; i++) {
			if (!variantIds[i] || !quantities[i] || quantities[i] <= 0 || isNaN(unitCosts[i]) || unitCosts[i] < 0) {
				return fail(400, { error: `Line ${i + 1} is missing a valid quantity or unit cost` });
			}
		}

		const store = await getAuthorizedAccountingStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const batchId = crypto.randomUUID();
		await db.insert(purchaseBatches).values({
			id: batchId,
			storeId: params.storeId,
			supplier,
			purchaseDate: new Date(purchaseDate),
			note,
			createdBy: locals.session.userId
		});

		const failedLines: string[] = [];

		for (let i = 0; i < variantIds.length; i++) {
			const variantId = variantIds[i];
			const sku = skus[i] || null;
			const quantity = quantities[i];
			const unitCost = unitCosts[i];

			const target = await getVariantForMutation(client, variantId);
			const adjustResult = target
				? await adjustInventoryQuantity(client, {
						inventoryItemId: target.inventoryItemId,
						locationId: target.locationId,
						delta: quantity,
						reason: 'restock'
					})
				: { success: false, actualDelta: null, raw: 'Variant not found in Shopify' };

			const lineId = crypto.randomUUID();
			const totalCost = unitCost * quantity;

			const ledger = await recordCostEvent({
				storeId: params.storeId,
				variantId,
				sku,
				type: 'purchase',
				quantityDelta: quantity,
				unitCost,
				sourceType: 'purchase',
				sourceId: lineId,
				shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
				shopifyExpectedDelta: quantity,
				shopifyActualDelta: adjustResult.actualDelta,
				shopifyResponseRaw: adjustResult.raw,
				createdBy: locals.session.userId
			});

			await db.insert(purchases).values({
				id: lineId,
				storeId: params.storeId,
				batchId,
				variantId,
				productId: productIds[i],
				productTitle: productTitles[i],
				variantTitle: variantTitles[i] || null,
				sku,
				quantity,
				unitCost: unitCost.toFixed(4),
				totalCost: totalCost.toFixed(2),
				purchaseDate: new Date(purchaseDate),
				note: null,
				shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
				createdBy: locals.session.userId
			});

			await logAudit(locals.session.userId, 'accounting', 'purchase.create', {
				targetType: 'purchase',
				targetId: lineId,
				storeId: params.storeId,
				metadata: {
					batchId,
					sku,
					quantity,
					unitCost,
					shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
					costEventId: ledger.eventId
				}
			});

			if (!adjustResult.success) failedLines.push(sku ?? productTitles[i]);
		}

		if (failedLines.length > 0) {
			// Batch + lines are already saved — surface which lines need a manual
			// Shopify fix rather than losing the whole purchase over a partial failure.
			const warning = `Shopify stock update failed for: ${failedLines.join(', ')} — check the audit log and adjust manually if needed.`;
			await db
				.update(purchaseBatches)
				.set({ note: note ? `${note}\n[${warning}]` : warning })
				.where(eq(purchaseBatches.id, batchId));
		}

		throw redirect(303, `/accounting/stores/${params.storeId}/purchases`);
	}
};
