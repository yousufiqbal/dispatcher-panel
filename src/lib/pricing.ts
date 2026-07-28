export type CostCurrency = 'cny' | 'pkr';

export interface PricingSettings {
	cnyToPkrRate: number;
	shippingCostPerGram: number;
	priceMultiplier: number;
	compareAtMultiplier: number;
	codPercentage: number;
}

export interface PricingInput {
	costAmount: number;
	costCurrency: CostCurrency;
	weightGrams: number;
}

export interface PricingResult {
	costPkr: number;
	baseCost: number;
	price: number;
	compareAtPrice: number;
}

export function roundToTen(n: number): number {
	return Math.round(n / 10) * 10;
}

// price/compareAt = (costPkr + weight_g * shippingCostPerGram) * multiplier * (1 + codPct/100),
// rounded to the nearest 10. compareAt uses the same base cost with its own multiplier.
export function calcSuggestedPricing(input: PricingInput, settings: PricingSettings): PricingResult {
	const costPkr = input.costCurrency === 'cny' ? input.costAmount * settings.cnyToPkrRate : input.costAmount;
	const baseCost = costPkr + input.weightGrams * settings.shippingCostPerGram;
	const codFactor = 1 + settings.codPercentage / 100;
	return {
		costPkr,
		baseCost,
		price: roundToTen(baseCost * settings.priceMultiplier * codFactor),
		compareAtPrice: roundToTen(baseCost * settings.compareAtMultiplier * codFactor)
	};
}

export function weightToGrams(value: number, unit: string): number {
	switch (unit) {
		case 'KILOGRAMS':
			return value * 1000;
		case 'OUNCES':
			return value * 28.3495;
		case 'POUNDS':
			return value * 453.592;
		default:
			return value; // GRAMS
	}
}
