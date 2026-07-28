import type { PricingProduct } from './shopify/pricing';
import { calcSuggestedPricing, type PricingSettings, type CostCurrency } from '$lib/pricing';
import type { variantPricing } from './db/schema';

type CostRow = typeof variantPricing.$inferSelect;

export interface PricingVariantView {
	id: string;
	inventoryItemId: string;
	title: string;
	sku: string | null;
	imageUrl: string | null;
	selectedOptions: { name: string; value: string }[];
	currentPrice: number;
	currentCompareAtPrice: number | null;
	liveWeightGrams: number;
	weightGrams: number;
	weightOverridden: boolean;
	costAmount: number;
	costCurrency: CostCurrency;
	suggestion: ReturnType<typeof calcSuggestedPricing> | null;
	// What will actually be pushed to Shopify: manual override if set,
	// else the formula's suggestion, else just leave the live value alone.
	finalPrice: number;
	finalCompareAtPrice: number;
	priceOverridden: boolean;
	compareAtOverridden: boolean;
	pending: boolean;
}

export interface PricingProductView {
	id: string;
	title: string;
	imageUrl: string | null;
	lastModifiedAt: Date | null;
	variants: PricingVariantView[];
}

export function buildPricingView(
	shopifyProducts: PricingProduct[],
	costRows: CostRow[],
	settings: PricingSettings
): PricingProductView[] {
	const costByVariant = new Map(costRows.map((r) => [r.variantId, r]));

	return shopifyProducts.map((p) => {
		const variantIds = new Set(p.variants.map((v) => v.id));
		const lastModifiedAt = costRows
			.filter((r) => variantIds.has(r.variantId))
			.reduce<Date | null>((latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest), null);

		return {
		id: p.id,
		title: p.title,
		imageUrl: p.imageUrl,
		lastModifiedAt,
		variants: p.variants.map((v) => {
			const cost = costByVariant.get(v.id);
			const costAmount = cost ? parseFloat(cost.costAmount) : 0;
			const costCurrency = (cost?.costCurrency ?? 'cny') as CostCurrency;
			const weightGrams = cost?.weightGramsOverride ?? v.weightGrams;
			const suggestion =
				costAmount > 0 ? calcSuggestedPricing({ costAmount, costCurrency, weightGrams }, settings) : null;

			const priceOverride = cost?.priceOverride != null ? parseFloat(cost.priceOverride) : null;
			const compareAtOverride = cost?.compareAtOverride != null ? parseFloat(cost.compareAtOverride) : null;
			// Final defaults to the *current* live Shopify value, not the formula's
			// suggestion — nothing is pending/pushed until the merchant deliberately
			// edits toward (or past) the suggested number.
			const finalPrice = priceOverride ?? v.price;
			const finalCompareAtPrice = compareAtOverride ?? v.compareAtPrice ?? 0;

			const weightOverridden = cost?.weightGramsOverride != null;
			const pending =
				Math.round(v.price) !== Math.round(finalPrice) ||
				Math.round(v.compareAtPrice ?? 0) !== Math.round(finalCompareAtPrice) ||
				(weightOverridden && weightGrams !== v.weightGrams);

			return {
				id: v.id,
				inventoryItemId: v.inventoryItemId,
				title: v.title,
				sku: v.sku,
				imageUrl: v.imageUrl,
				selectedOptions: v.selectedOptions,
				currentPrice: v.price,
				currentCompareAtPrice: v.compareAtPrice,
				liveWeightGrams: v.weightGrams,
				weightGrams,
				weightOverridden,
				costAmount,
				costCurrency,
				suggestion,
				finalPrice,
				finalCompareAtPrice,
				priceOverridden: priceOverride != null,
				compareAtOverridden: compareAtOverride != null,
				pending
			};
		})
		};
	});
}
