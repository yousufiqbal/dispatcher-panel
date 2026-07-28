import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores, variantPricing, pricingReviewMarks } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchPricingProducts } from '$lib/server/shopify/pricing';
import type { PricingSettings } from '$lib/pricing';
import { buildPricingView } from '$lib/server/pricing-diff';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const store = await db.query.stores.findFirst({ where: eq(stores.id, params.id) });
	if (!store) error(404, 'Store not found');

	const client = getShopifyClient(store);
	const [shopifyProducts, costRows, reviewRows] = await Promise.all([
		fetchPricingProducts(client),
		db.query.variantPricing.findMany({ where: eq(variantPricing.storeId, params.id) }),
		db.query.pricingReviewMarks.findMany({ where: eq(pricingReviewMarks.storeId, params.id) })
	]);

	const settings: PricingSettings = {
		cnyToPkrRate: parseFloat(store.cnyToPkrRate),
		shippingCostPerGram: parseFloat(store.shippingCostPerGram),
		priceMultiplier: parseFloat(store.priceMultiplier),
		compareAtMultiplier: parseFloat(store.compareAtMultiplier),
		codPercentage: parseFloat(store.codPercentage)
	};

	const reviewedIds = new Set(reviewRows.map((r) => r.productId));
	const products = buildPricingView(shopifyProducts, costRows, settings).map((p) => ({
		...p,
		reviewed: reviewedIds.has(p.id)
	}));
	const hasPendingChanges = products.some((p) => p.variants.some((v) => v.pending));

	return {
		store: {
			id: store.id,
			name: store.name,
			cnyToPkrRate: store.cnyToPkrRate,
			shippingCostPerGram: store.shippingCostPerGram,
			priceMultiplier: store.priceMultiplier,
			compareAtMultiplier: store.compareAtMultiplier,
			codPercentage: store.codPercentage
		},
		products,
		hasPendingChanges
	};
};

export const actions: Actions = {
	saveSettings: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const fields = ['cnyToPkrRate', 'shippingCostPerGram', 'priceMultiplier', 'compareAtMultiplier', 'codPercentage'] as const;
		const values: Record<string, string> = {};
		for (const f of fields) {
			const raw = fd.get(f)?.toString() ?? '';
			if (!raw || isNaN(parseFloat(raw)) || parseFloat(raw) < 0) return fail(400, { settingsError: `Invalid ${f}` });
			values[f] = raw;
		}

		await db.update(stores).set(values).where(eq(stores.id, params.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'pricing.settings.update', {
				targetType: 'store', targetId: params.id, storeId: params.id, metadata: values
			});
		}

		return { settingsSaved: true };
	},

	saveVariant: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const variantId = fd.get('variantId')?.toString();
		const productId = fd.get('productId')?.toString();
		const costAmount = fd.get('costAmount')?.toString() ?? '0';
		const costCurrency = fd.get('costCurrency')?.toString();
		const weightGramsRaw = fd.get('weightGrams')?.toString();
		const priceOverrideRaw = fd.get('priceOverride')?.toString();
		const compareAtOverrideRaw = fd.get('compareAtOverride')?.toString();

		if (!variantId || !productId || (costCurrency !== 'cny' && costCurrency !== 'pkr')) return fail(400);
		if (isNaN(parseFloat(costAmount)) || parseFloat(costAmount) < 0) return fail(400, { variantError: 'Invalid cost' });

		const weightGramsOverride = weightGramsRaw ? Math.max(0, Math.round(parseFloat(weightGramsRaw))) : null;
		const priceOverride = priceOverrideRaw ? String(Math.max(0, parseFloat(priceOverrideRaw))) : null;
		const compareAtOverride = compareAtOverrideRaw ? String(Math.max(0, parseFloat(compareAtOverrideRaw))) : null;

		const existing = await db.query.variantPricing.findFirst({
			where: and(eq(variantPricing.storeId, params.id), eq(variantPricing.variantId, variantId))
		});

		if (existing) {
			await db
				.update(variantPricing)
				.set({ costAmount, costCurrency, weightGramsOverride, priceOverride, compareAtOverride, updatedBy: locals.session!.userId, updatedAt: new Date() })
				.where(and(eq(variantPricing.storeId, params.id), eq(variantPricing.variantId, variantId)));
		} else {
			await db.insert(variantPricing).values({
				storeId: params.id,
				variantId,
				productId,
				costAmount,
				costCurrency,
				weightGramsOverride,
				priceOverride,
				compareAtOverride,
				updatedBy: locals.session!.userId
			});
		}

		return { variantSaved: variantId };
	},

	toggleReviewed: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const productId = fd.get('productId')?.toString();
		const checked = fd.get('checked')?.toString() === 'true';
		if (!productId) return fail(400);

		if (checked) {
			const existing = await db.query.pricingReviewMarks.findFirst({
				where: and(eq(pricingReviewMarks.storeId, params.id), eq(pricingReviewMarks.productId, productId))
			});
			if (!existing) {
				await db.insert(pricingReviewMarks).values({ storeId: params.id, productId, markedBy: locals.session!.userId });
			}
		} else {
			await db
				.delete(pricingReviewMarks)
				.where(and(eq(pricingReviewMarks.storeId, params.id), eq(pricingReviewMarks.productId, productId)));
		}

		return { toggled: productId };
	},

	resetAllReviewed: async ({ params, locals }) => {
		await db.delete(pricingReviewMarks).where(eq(pricingReviewMarks.storeId, params.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'pricing.reviewMarks.resetAll', {
				targetType: 'store', targetId: params.id, storeId: params.id
			});
		}

		return { resetAll: true };
	}
};
