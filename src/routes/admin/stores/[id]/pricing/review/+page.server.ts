import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores, variantPricing } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchPricingProducts, applyProductVariantPrices, applyVariantWeight } from '$lib/server/shopify/pricing';
import type { PricingSettings } from '$lib/pricing';
import { buildPricingView } from '$lib/server/pricing-diff';
import { logAudit } from '$lib/server/audit';

async function loadPendingChanges(storeId: string) {
	const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
	if (!store) error(404, 'Store not found');

	const client = getShopifyClient(store);
	const [shopifyProducts, costRows] = await Promise.all([
		fetchPricingProducts(client),
		db.query.variantPricing.findMany({ where: eq(variantPricing.storeId, storeId) })
	]);

	const settings: PricingSettings = {
		cnyToPkrRate: parseFloat(store.cnyToPkrRate),
		shippingCostPerGram: parseFloat(store.shippingCostPerGram),
		priceMultiplier: parseFloat(store.priceMultiplier),
		compareAtMultiplier: parseFloat(store.compareAtMultiplier),
		codPercentage: parseFloat(store.codPercentage)
	};

	const products = buildPricingView(shopifyProducts, costRows, settings);
	const changedProducts = products
		.map((p) => ({ ...p, variants: p.variants.filter((v) => v.pending) }))
		.filter((p) => p.variants.length > 0);

	return { store, changedProducts };
}

export const load: PageServerLoad = async ({ params }) => {
	const { store, changedProducts } = await loadPendingChanges(params.id);
	return {
		store: { id: store.id, name: store.name },
		changedProducts
	};
};

export const actions: Actions = {
	apply: async ({ params, locals }) => {
		const { store, changedProducts } = await loadPendingChanges(params.id);
		if (changedProducts.length === 0) return fail(400, { applyError: 'No pending changes left to apply', appliedCount: 0 });

		const client = getShopifyClient(store);
		const errors: string[] = [];
		let appliedCount = 0;

		for (const product of changedProducts) {
			try {
				await applyProductVariantPrices(
					client,
					product.id,
					product.variants.map((v) => ({
						variantId: v.id,
						price: Math.round(v.currentPrice) !== Math.round(v.finalPrice) ? v.finalPrice : undefined,
						compareAtPrice:
							Math.round(v.currentCompareAtPrice ?? 0) !== Math.round(v.finalCompareAtPrice)
								? v.finalCompareAtPrice
								: undefined
					}))
				);
				appliedCount += product.variants.length;
			} catch (e) {
				errors.push(`${product.title}: ${e instanceof Error ? e.message : 'price update failed'}`);
				continue;
			}

			for (const v of product.variants) {
				if (v.weightOverridden && v.weightGrams !== v.liveWeightGrams) {
					try {
						await applyVariantWeight(client, v.inventoryItemId, v.weightGrams);
						// Shopify is the source of truth for weight — once pushed, drop the
						// staged copy so a later edit on the Weights page isn't shadowed.
						await db
							.update(variantPricing)
							.set({ weightGramsOverride: null })
							.where(and(eq(variantPricing.storeId, params.id), eq(variantPricing.variantId, v.id)));
					} catch (e) {
						errors.push(`${product.title} / ${v.title}: weight update failed`);
					}
				}
			}
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'pricing.changes.apply', {
				targetType: 'store', targetId: params.id, storeId: params.id,
				metadata: { appliedCount, errorCount: errors.length }
			});
		}

		if (errors.length) return fail(422, { applyError: errors.join('; '), appliedCount });

		redirect(303, `/admin/stores/${params.id}/pricing`);
	}
};
