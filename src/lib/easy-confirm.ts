// Formatting helpers for the Easy Confirm page. Ported from the standalone
// Easy Confirm Shopify app; safe to import on both server and client.

export type EasyConfirmTab = 'pending' | 'between' | 'confirmed';

/**
 * Why an order is parked in Between. Each is a Shopify tag written as
 * "Between: <reason>", so in Shopify admin it reads plainly and every Between
 * tag sorts together in the tag filter.
 *
 * `legacy` lists the plain tags used before this format (the Orders page and
 * its Check Addresses feature still write the first three). They're still
 * read as Between, and any move clears them.
 */
export const BETWEEN_REASONS = [
	{ tag: 'Between: Not Reachable', label: 'Not Reachable', legacy: ['not-reachable'] },
	{ tag: 'Between: On Hold', label: 'On Hold', legacy: ['on-hold'] },
	{ tag: 'Between: Incorrect Address', label: 'Incorrect Address', legacy: ['incorrect-address'] },
	{ tag: 'Between: Item Missing', label: 'Item Missing', legacy: ['item-missing'] },
	// Customer confirmed by phone, then refused the COD parcel at the door.
	{ tag: 'Between: Rejector', label: 'Rejector', legacy: ['rejector'] },
	{ tag: 'Between: Other', label: 'Other', legacy: ['between-other'] }
] as const;

export type BetweenTag = (typeof BETWEEN_REASONS)[number]['tag'];
/** Tags the panel writes. */
export const BETWEEN_TAGS: string[] = BETWEEN_REASONS.map((r) => r.tag);
/** Every tag that means Between — current and legacy — for reading and clearing. */
export const ALL_BETWEEN_TAGS: string[] = BETWEEN_REASONS.flatMap((r) => [r.tag, ...r.legacy]);
export const BETWEEN_OTHER_TAG: BetweenTag = 'Between: Other';

/** Current tag for any Between tag (legacy or current, any case), or null. */
export function canonicalBetweenTag(tag: string): BetweenTag | null {
	const t = tag.trim().toLowerCase();
	return BETWEEN_REASONS.find((r) => r.tag.toLowerCase() === t || r.legacy.some((l) => l === t))?.tag ?? null;
}

/** Order custom attribute holding the typed text for an "Other" reason. */
export const BETWEEN_NOTE_KEY = 'Between reason';
export const BETWEEN_NOTE_MAX = 200;

export function betweenLabel(tag: string): string {
	const canonical = canonicalBetweenTag(tag);
	return BETWEEN_REASONS.find((r) => r.tag === canonical)?.label ?? tag;
}

export interface AddressFields {
	firstName: string;
	lastName: string;
	company: string;
	address1: string;
	address2: string;
	city: string;
	provinceCode: string;
	zip: string;
	countryCode: string;
	country: string;
	phone: string;
}

export interface EasyConfirmRow {
	id: string;
	legacyId: string;
	name: string;
	createdAt: string;
	/** "Today at 4:17 pm", formatted on the server in the shop's timezone. */
	date: string;
	customer: string;
	/** Shopify customer GID; null for guest checkouts. Merging requires a match. */
	customerId: string | null;
	email: string;
	phone: string;
	/** International digits without "+", for tel: and WhatsApp links. */
	phoneDigits: string | null;
	shipTo: string;
	address: string;
	shipping: AddressFields | null;
	total: string;
	financialStatus: string;
	fulfillmentStatus: string;
	items: number;
	lineItems: { id: string; title: string; variantTitle: string; quantity: number; imageUrl: string }[];
	state: EasyConfirmTab;
	/** Between reason tags on the order (normally one). */
	betweenTags: string[];
	/** Typed text for an "Other" reason, if any. */
	betweenNote: string;
}

// Shopify's province codes for Pakistan.
export const PK_PROVINCES = [
	{ code: 'JK', name: 'Azad Kashmir' },
	{ code: 'BA', name: 'Balochistan' },
	{ code: 'TA', name: 'FATA' },
	{ code: 'GB', name: 'Gilgit-Baltistan' },
	{ code: 'IS', name: 'Islamabad Capital Territory' },
	{ code: 'KP', name: 'Khyber Pakhtunkhwa' },
	{ code: 'PB', name: 'Punjab' },
	{ code: 'SD', name: 'Sindh' }
];

/**
 * Converts a phone number into international digits (no "+"), which is what
 * both `tel:` and `whatsapp://send?phone=` expect.
 * Pakistani local formats are handled: 0300-1234567, 300 1234567, 92300...
 */
export function toInternationalDigits(raw: string | null | undefined, countryCode?: string | null): string | null {
	if (!raw) return null;
	const digits = raw.replace(/\D/g, '');
	if (!digits) return null;

	if (raw.trim().startsWith('+')) return digits;
	if (digits.startsWith('00')) return digits.slice(2);

	if (!countryCode || countryCode === 'PK') {
		if (digits.startsWith('92') && digits.length === 12) return digits;
		if (digits.startsWith('0') && digits.length === 11) return `92${digits.slice(1)}`;
		if (digits.startsWith('3') && digits.length === 10) return `92${digits}`;
	}

	return digits;
}

type Address = {
	address1?: string | null;
	address2?: string | null;
	city?: string | null;
	province?: string | null;
	zip?: string | null;
	country?: string | null;
};

export function formatAddress(address: Address | null | undefined): string {
	if (!address) return '';
	const provinceZip = [address.province, address.zip].filter(Boolean).join(' ');
	return [address.address1, address.address2, address.city, provinceZip, address.country]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(', ');
}

/** "PARTIALLY_PAID" -> "Partially paid" */
export function humanizeEnum(value: string | null | undefined): string {
	if (!value) return '';
	const text = value.toLowerCase().replace(/_/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatMoney(amount: string, currencyCode: string): string {
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currencyCode,
			currencyDisplay: 'narrowSymbol'
		}).format(Number(amount));
	} catch {
		return `${currencyCode} ${amount}`;
	}
}

/**
 * Shopify-style order date in the shop timezone: "Today at 4:17 pm",
 * "Yesterday at …", weekday within the last week, otherwise "Oct 3 at …".
 * Formatted on the server so SSR and the browser agree.
 */
export function formatOrderDate(iso: string, timeZone: string, now: Date = new Date()): string {
	const date = new Date(iso);
	const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(d); // YYYY-MM-DD
	const daysAgo = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(date))) / 86_400_000);

	let day: string;
	if (daysAgo === 0) day = 'Today';
	else if (daysAgo === 1) day = 'Yesterday';
	else if (daysAgo > 1 && daysAgo < 7) {
		day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(date);
	} else {
		day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(date);
	}

	const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
		.format(date)
		.toLowerCase();
	return `${day} at ${time}`;
}

// Badge colours, mirroring the app's Polaris tones.
export function financialBadge(status: string): string {
	if (['PENDING', 'PARTIALLY_PAID', 'AUTHORIZED'].includes(status)) return 'bg-amber-100 text-amber-800';
	if (status === 'EXPIRED') return 'bg-red-100 text-red-800';
	return 'bg-zinc-100 text-zinc-700';
}

export function fulfillmentBadge(status: string): string {
	if (['UNFULFILLED', 'PARTIALLY_FULFILLED', 'ON_HOLD'].includes(status)) return 'bg-amber-100 text-amber-800';
	if (['IN_PROGRESS', 'SCHEDULED'].includes(status)) return 'bg-sky-100 text-sky-800';
	return 'bg-zinc-100 text-zinc-700';
}
