// Restock recommendation math — shared by the server (urgency sort at session
// start) and the browser (table view recomputes from streamed live stock).

export interface LiveStock {
	// Physical units at the location (available + committed + unavailable).
	onHand: number;
	available: number;
	committed: number;
	incoming: number;
}

export interface RestockCalc {
	dailyVelocity: number;
	// Days until available + incoming runs out at the current velocity; null
	// when the variant isn't selling (never runs out).
	coverDays: number | null;
	recAir: number;
	recSea: number;
}

// Units to have on hand after the order lands, expressed as days of sales.
export const COVER_DAYS = 30;

// 30-day rate, except when the variant is out of stock: a sold-out variant
// couldn't sell, so its 30-day number understates demand. Then take the best
// rate across the 30/60/90 windows instead.
export function dailyVelocity(s30: number, s60: number, s90: number, available: number): number {
	const v30 = s30 / 30;
	if (available > 0) return v30;
	return Math.max(v30, s60 / 60, s90 / 90);
}

// `available` is kept signed: an oversold variant (negative available) owes
// those units to customers, so they're added to the order rather than lost.
// `incoming` (open Shopify purchase orders / transfers) is already on its way
// and is subtracted so it isn't ordered twice.
export function calcRestock(
	sales: { s30: number; s60: number; s90: number },
	stock: LiveStock,
	lead: { airDays: number; seaDays: number }
): RestockCalc {
	const v = dailyVelocity(sales.s30, sales.s60, sales.s90, stock.available);
	const position = stock.available + stock.incoming;
	const rec = (leadDays: number) => Math.max(0, Math.ceil(v * (leadDays + COVER_DAYS) - position));

	return {
		dailyVelocity: v,
		coverDays: v > 0 ? Math.max(0, position / v) : null,
		recAir: rec(lead.airDays),
		recSea: rec(lead.seaDays)
	};
}

// Red: runs out before even an air shipment could land. Amber: before a sea
// shipment could. Drives the badge colour and the table's urgency sort.
export type Urgency = 'critical' | 'soon' | 'ok' | 'idle';

export function urgency(calc: RestockCalc, lead: { airDays: number; seaDays: number }): Urgency {
	if (calc.coverDays === null) return 'idle';
	if (calc.coverDays < lead.airDays) return 'critical';
	if (calc.coverDays < lead.seaDays) return 'soon';
	return 'ok';
}
