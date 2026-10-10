// Shared by the Weights page and its apply endpoint so both agree on what a
// valid weight is. Everything is whole grams — Shopify is the source of truth
// and every save writes unit GRAMS.

export const MAX_GRAMS = 50_000;
// Above this the review dialog asks for a second look — rare for this catalog.
export const HEAVY_WARN_GRAMS = 10_000;

/** Accepts "450", "450g", "1.2kg", "1,200". Returns null for anything unparseable. */
export function parseGrams(raw: string): number | null {
	const s = raw.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
	if (s === '') return null;
	const m = s.match(/^(\d+(?:\.\d+)?|\.\d+)(kg|g)?$/);
	if (!m) return null;
	const n = parseFloat(m[1]) * (m[2] === 'kg' ? 1000 : 1);
	const grams = Math.round(n);
	return grams >= 0 && grams <= MAX_GRAMS ? grams : null;
}

export function formatGrams(g: number): string {
	return `${g.toLocaleString('en-US')} g`;
}

export function median(values: number[]): number {
	if (values.length === 0) return 0;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// A weighted variant is an outlier when it's far off the median of its
// weighted siblings — usually a typo (5000 for 500). Needs 3+ weighted
// siblings for the median to mean anything.
export const OUTLIER_HIGH = 2.5;
export const OUTLIER_LOW = 0.4;

export function isOutlier(grams: number, siblingGrams: number[]): boolean {
	const weighted = siblingGrams.filter((g) => g > 0);
	if (grams <= 0 || weighted.length < 3) return false;
	const m = median(weighted);
	return m > 0 && (grams >= m * OUTLIER_HIGH || grams <= m * OUTLIER_LOW);
}

export interface WeightChange {
	variantId: string;
	// What the page saw when it loaded — the server skips the change if
	// Shopify no longer matches (edited elsewhere in the meantime).
	expectedGrams: number;
	grams: number;
}

export interface WeightApplyRequest {
	products: { productId: string; changes: WeightChange[] }[];
}

export interface WeightApplyResponse {
	applied: string[];
	conflicts: { variantId: string; liveGrams: number }[];
	failed: { variantId: string; error: string }[];
}

export const MAX_APPLY_PRODUCTS = 10;
