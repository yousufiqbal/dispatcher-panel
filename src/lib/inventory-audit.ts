// Flags counts different enough from Shopify to deserve a second look before
// they're applied — typically a typo (100 for 10) or a miscounted shelf. Small
// absolute drifts on big stock levels aren't flagged.
export function isBigDifference(systemStock: number, counted: number): boolean {
	const diff = Math.abs(counted - systemStock);
	return diff >= 5 && diff >= Math.max(1, Math.abs(systemStock)) * 0.5;
}
