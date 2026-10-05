// Shared types and rules for the Tracker page (fulfilled, not yet delivered).

/** Where a parcel stands, from the courier's latest status. */
export type TrackerStage = 'tracking' | 'transit' | 'out' | 'attempted';
export type TrackerTab = TrackerStage | 'late';

/** An order counts as Late once this many business days have fully passed since dispatch. */
export const LATE_AFTER_BUSINESS_DAYS = 5;

/**
 * A "Tracking only" parcel is flagged once this many business days pass with
 * no courier movement — it should have been scanned by then.
 */
export const STALE_TRACKING_AFTER_BUSINESS_DAYS = 1;

/** Tracked but never scanned, and past the grace period. */
export function isStaleTracking(r: { stage: TrackerStage; businessDays: number }): boolean {
	return r.stage === 'tracking' && r.businessDays >= STALE_TRACKING_AFTER_BUSINESS_DAYS;
}

/**
 * Stage for a not-yet-delivered parcel. Anything that isn't a courier movement
 * status (FULFILLED, CONFIRMED, LABEL_*, …) means the courier hasn't reported
 * anything yet — "Tracking only".
 */
export function stageOf(displayStatus: string | null): TrackerStage {
	if (displayStatus === 'ATTEMPTED_DELIVERY') return 'attempted';
	if (displayStatus === 'OUT_FOR_DELIVERY') return 'out';
	if (displayStatus === 'IN_TRANSIT') return 'transit';
	return 'tracking';
}

/** "Dispatched within" choices, in days. */
export const TRACKER_WINDOWS = [30, 60, 120] as const;
export const DEFAULT_TRACKER_WINDOW = 60;
/** Upper bound for a custom `?days=` typed into the URL. */
export const MAX_TRACKER_WINDOW = 365;

export interface TrackerRow {
	id: string;
	legacyId: string;
	name: string;
	customer: string;
	phone: string;
	phoneDigits: string | null;
	city: string;
	total: string;
	financialStatus: string;
	/** Shopify Fulfillment.displayStatus, or null when the courier hasn't reported anything. */
	displayStatus: string | null;
	courier: string;
	trackingNumber: string;
	trackingUrl: string;
	dispatchedAt: string;
	/** "Today at 4:17 pm" etc., formatted on the server in the shop timezone. */
	dispatchedLabel: string;
	/** Business days (Mon–Fri) fully passed since the dispatch day. */
	businessDays: number;
	stage: TrackerStage;
	late: boolean;
}

/** YYYY-MM-DD for `date` as seen in `timeZone`. */
function dayKey(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/**
 * Business days (Mon–Fri) that have *fully passed* since the dispatch day, in
 * the shop's timezone. The dispatch day itself and today (still in progress)
 * don't count. Public holidays aren't known, so they count as business days.
 *
 * Example: dispatched Monday → next Monday is 4 (Tue–Fri), next Tuesday is 5.
 */
export function businessDaysSince(dispatchedIso: string, timeZone: string, now: Date = new Date()): number {
	const start = Date.parse(dayKey(new Date(dispatchedIso), timeZone)); // UTC midnight of dispatch day
	const today = Date.parse(dayKey(now, timeZone));
	let count = 0;
	for (let t = start + 86_400_000; t < today; t += 86_400_000) {
		const dow = new Date(t).getUTCDay();
		if (dow !== 0 && dow !== 6) count++;
	}
	return count;
}
