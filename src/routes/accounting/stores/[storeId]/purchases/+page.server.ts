import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { purchases } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';
import { getVariantForMutation, adjustInventoryQuantity } from '$lib/server/shopify/restock';
import { recordCostEvent } from '$lib/server/accounting/cost-ledger';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const rows = await db
		.select()
		.from(purchases)
		.where(eq(purchases.storeId, params.storeId))
		.orderBy(desc(purchases.purchaseDate))
		.limit(50);

	return { purchases: rows };
};

export const actions: Actions = {
	addPurchase: async ({ request, params, locals }) => {
		if (!locals.session) return fail(401);

		const fd = await request.formData();
		const variantId = fd.get('variantId') as string;
		const productId = fd.get('productId') as string;
		const productTitle = fd.get('productTitle') as string;
		const variantTitle = (fd.get('variantTitle') as string) || null;
		const sku = (fd.get('sku') as string) || null;
		const quantity = parseInt(fd.get('quantity') as string, 10);
		const unitCost = parseFloat(fd.get('unitCost') as string);
		const purchaseDate = fd.get('purchaseDate') as string;
		const note = (fd.get('note') as string)?.trim() || null;

		if (!variantId || !productId || !productTitle || !purchaseDate || !quantity || quantity <= 0 || isNaN(unitCost) || unitCost < 0) {
			return fail(400, { error: 'Pick a variant and enter a valid quantity, unit cost, and date' });
		}

		const store = await getAuthorizedAccountingStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const target = await getVariantForMutation(client, variantId);
		if (!target) {
			return fail(422, { error: 'Could not resolve that variant in Shopify — it may have been deleted' });
		}

		const adjustResult = await adjustInventoryQuantity(client, {
			inventoryItemId: target.inventoryItemId,
			locationId: target.locationId,
			delta: quantity,
			reason: 'restock'
		});

		const purchaseId = crypto.randomUUID();
		const totalCost = unitCost * quantity;

		const ledger = await recordCostEvent({
			storeId: params.storeId,
			variantId,
			sku,
			type: 'purchase',
			quantityDelta: quantity,
			unitCost,
			sourceType: 'purchase',
			sourceId: purchaseId,
			shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
			shopifyExpectedDelta: quantity,
			shopifyActualDelta: adjustResult.actualDelta,
			shopifyResponseRaw: adjustResult.raw,
			createdBy: locals.session.userId
		});

		await db.insert(purchases).values({
			id: purchaseId,
			storeId: params.storeId,
			variantId,
			productId,
			productTitle,
			variantTitle,
			sku,
			quantity,
			unitCost: unitCost.toFixed(4),
			totalCost: totalCost.toFixed(2),
			purchaseDate: new Date(purchaseDate),
			note,
			shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
			createdBy: locals.session.userId
		});

		await logAudit(locals.session.userId, 'accounting', 'purchase.create', {
			targetType: 'purchase',
			targetId: purchaseId,
			storeId: params.storeId,
			metadata: {
				sku,
				quantity,
				unitCost,
				shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
				costEventId: ledger.eventId
			}
		});

		if (!adjustResult.success) {
			return {
				success: true,
				warning: `Recorded, but the Shopify stock update failed — check the audit log (event ${ledger.eventId}) and adjust the count manually in Shopify if needed.`
			};
		}

		return { success: true };
	}
};
