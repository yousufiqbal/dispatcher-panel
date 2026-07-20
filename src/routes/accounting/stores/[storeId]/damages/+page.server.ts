import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { damages } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';
import { getVariantForMutation, adjustInventoryQuantity } from '$lib/server/shopify/restock';
import { recordCostEvent } from '$lib/server/accounting/cost-ledger';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const rows = await db
		.select()
		.from(damages)
		.where(eq(damages.storeId, params.storeId))
		.orderBy(desc(damages.damageDate))
		.limit(50);

	return { damages: rows };
};

export const actions: Actions = {
	addDamage: async ({ request, params, locals }) => {
		if (!locals.session) return fail(401);

		const fd = await request.formData();
		const variantId = fd.get('variantId') as string;
		const productId = fd.get('productId') as string;
		const productTitle = fd.get('productTitle') as string;
		const variantTitle = (fd.get('variantTitle') as string) || null;
		const sku = (fd.get('sku') as string) || null;
		const quantity = parseInt(fd.get('quantity') as string, 10);
		const damageDate = fd.get('damageDate') as string;
		const reason = (fd.get('reason') as string)?.trim() || null;

		if (!variantId || !productId || !productTitle || !damageDate || !quantity || quantity <= 0) {
			return fail(400, { error: 'Pick a variant and enter a valid quantity and date' });
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
			delta: -quantity,
			reason: 'damaged'
		});

		const damageId = crypto.randomUUID();

		const ledger = await recordCostEvent({
			storeId: params.storeId,
			variantId,
			sku,
			type: 'damage',
			quantityDelta: -quantity,
			sourceType: 'damage',
			sourceId: damageId,
			shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
			shopifyExpectedDelta: -quantity,
			shopifyActualDelta: adjustResult.actualDelta,
			shopifyResponseRaw: adjustResult.raw,
			createdBy: locals.session.userId
		});

		await db.insert(damages).values({
			id: damageId,
			storeId: params.storeId,
			variantId,
			productId,
			productTitle,
			variantTitle,
			sku,
			quantity,
			costAtDamageTime: ledger.unitCost.toFixed(4),
			totalCost: ledger.totalCost.toFixed(2),
			reason,
			damageDate: new Date(damageDate),
			shopifyAdjustmentStatus: adjustResult.success ? 'success' : 'failed',
			createdBy: locals.session.userId
		});

		await logAudit(locals.session.userId, 'accounting', 'damage.create', {
			targetType: 'damage',
			targetId: damageId,
			storeId: params.storeId,
			metadata: {
				sku,
				quantity,
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
