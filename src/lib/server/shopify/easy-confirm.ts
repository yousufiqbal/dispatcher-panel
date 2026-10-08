import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';
import { CONFIRMED_TAG } from './orders';
import {
	BETWEEN_NOTE_KEY,
	ALL_BETWEEN_TAGS,
	BETWEEN_OTHER_TAG,
	canonicalBetweenTag,
	formatAddress,
	formatMoney,
	formatOrderDate,
	toInternationalDigits,
	type AddressFields,
	type EasyConfirmRow,
	type EasyConfirmTab
} from '$lib/easy-confirm';

// Same scope as the Orders page's Pending/Confirmed tabs: open orders that
// haven't shipped.
const SCOPE_QUERY = 'status:open fulfillment_status:unfulfilled';
// Open orders that have shipped — shown read-only in the Fulfilled tab.
const FULFILLED_QUERY = 'status:open fulfillment_status:shipped';

const ORDERS_QUERY = `
	query EasyConfirmOrders($after: String, $query: String!) {
		shop { ianaTimezone }
		orders(first: 250, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
			pageInfo { hasNextPage endCursor }
			nodes {
				id
				legacyResourceId
				name
				createdAt
				displayFinancialStatus
				displayFulfillmentStatus
				currentSubtotalLineItemsQuantity
				tags
				phone
				email
				currentTotalPriceSet { shopMoney { amount currencyCode } }
				customer { id displayName defaultEmailAddress { emailAddress } defaultPhoneNumber { phoneNumber } }
				shippingAddress { name firstName lastName company address1 address2 city province provinceCode zip country countryCodeV2 phone }
				billingAddress { phone }
				customAttributes { key value }
				lineItems(first: 50) {
					nodes { id title variantTitle currentQuantity image { url altText } }
				}
			}
		}
	}
`;

type Money = { shopMoney: { amount: string; currencyCode: string } };

interface OrderNode {
	id: string;
	legacyResourceId: string;
	name: string;
	createdAt: string;
	displayFinancialStatus: string | null;
	displayFulfillmentStatus: string | null;
	currentSubtotalLineItemsQuantity: number;
	tags: string[];
	phone: string | null;
	email: string | null;
	currentTotalPriceSet: Money | null;
	customer: {
		id: string;
		displayName: string;
		defaultEmailAddress: { emailAddress: string } | null;
		defaultPhoneNumber: { phoneNumber: string } | null;
	} | null;
	shippingAddress: {
		name: string | null;
		firstName: string | null;
		lastName: string | null;
		company: string | null;
		address1: string | null;
		address2: string | null;
		city: string | null;
		province: string | null;
		provinceCode: string | null;
		zip: string | null;
		country: string | null;
		countryCodeV2: string | null;
		phone: string | null;
	} | null;
	billingAddress: { phone: string | null } | null;
	customAttributes: { key: string; value: string | null }[];
	lineItems: {
		nodes: { id: string; title: string; variantTitle: string | null; currentQuantity: number; image: { url: string } | null }[];
	};
}

/**
 * Orders confirmed through the standalone Easy Confirm Shopify app carry a
 * lowercase "confirmed" tag; the panel writes "Confirmed". Read either, so an
 * order confirmed in one place shows as confirmed in the other.
 */
export function hasConfirmedTag(tags: string[]): boolean {
	return tags.some((t) => t.trim().toLowerCase() === CONFIRMED_TAG.toLowerCase());
}

// Between reasons on an order, normalised to the current "Between: …" tags
// (so a legacy "on-hold" shows as On Hold), without duplicates.
function betweenTagsOf(tags: string[]): string[] {
	return [...new Set(tags.map(canonicalBetweenTag).filter((t): t is NonNullable<typeof t> => !!t))];
}

// Confirmed wins over Between, which wins over Pending. Moves always clear the
// other states' tags, so overlap only happens if someone tags by hand in
// Shopify admin.
function stateOf(tags: string[]): EasyConfirmTab {
	if (hasConfirmedTag(tags)) return 'confirmed';
	if (betweenTagsOf(tags).length > 0) return 'between';
	return 'pending';
}

function toRow(o: OrderNode, timeZone: string, fulfilled = false): EasyConfirmRow {
	const a = o.shippingAddress;
	const phone =
		a?.phone || o.phone || o.customer?.defaultPhoneNumber?.phoneNumber || o.billingAddress?.phone || '';
	const total = o.currentTotalPriceSet;
	return {
		id: o.id,
		legacyId: o.legacyResourceId,
		name: o.name,
		createdAt: o.createdAt,
		date: formatOrderDate(o.createdAt, timeZone),
		customer: o.customer?.displayName || a?.name || 'No customer',
		customerId: o.customer?.id ?? null,
		email: o.email || o.customer?.defaultEmailAddress?.emailAddress || '',
		phone,
		phoneDigits: toInternationalDigits(phone, a?.countryCodeV2),
		shipTo: a?.name || '',
		address: formatAddress(a),
		shipping: a
			? {
					firstName: a.firstName || '',
					lastName: a.lastName || '',
					company: a.company || '',
					address1: a.address1 || '',
					address2: a.address2 || '',
					city: a.city || '',
					provinceCode: a.provinceCode || '',
					zip: a.zip || '',
					countryCode: a.countryCodeV2 || '',
					country: a.country || '',
					phone: a.phone || ''
				}
			: null,
		total: total ? formatMoney(total.shopMoney.amount, total.shopMoney.currencyCode) : '',
		financialStatus: o.displayFinancialStatus || '',
		fulfillmentStatus: o.displayFulfillmentStatus || '',
		items: o.currentSubtotalLineItemsQuantity,
		// Removed (edited-out) lines aren't part of what ships.
		lineItems: o.lineItems.nodes
			.filter((li) => li.currentQuantity > 0)
			.map((li) => ({
				id: li.id,
				title: li.title,
				variantTitle: li.variantTitle || '',
				quantity: li.currentQuantity,
				imageUrl: li.image?.url || ''
			})),
		state: fulfilled ? 'fulfilled' : stateOf(o.tags),
		betweenTags: betweenTagsOf(o.tags),
		betweenNote: o.customAttributes?.find((a) => a.key === BETWEEN_NOTE_KEY)?.value ?? ''
	};
}

/**
 * Every open, unfulfilled order placed in the last `days` days, plus open
 * fulfilled ones for the Fulfilled tab, newest first. Pending/Confirmed is split afterwards from each order's live `tags` —
 * Shopify's tag search lags a few seconds behind tag changes, so filtering by
 * it would leave just-confirmed orders stuck in the wrong tab.
 */
export async function listEasyConfirmOrders(client: ShopifyClient, days: number): Promise<EasyConfirmRow[]> {
	// Day precision, same format Tracker uses.
	const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
	const window = ` created_at:>=${since}`;
	const [unfulfilled, fulfilled] = await Promise.all([
		fetchRows(client, SCOPE_QUERY + window, false),
		fetchRows(client, FULFILLED_QUERY + window, true)
	]);
	return [...unfulfilled, ...fulfilled];
}

async function fetchRows(client: ShopifyClient, query: string, fulfilled: boolean): Promise<EasyConfirmRow[]> {
	const rows: EasyConfirmRow[] = [];
	let after: string | null = null;
	let timeZone = 'UTC';
	while (true) {
		const data: {
			shop: { ianaTimezone: string | null };
			orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: OrderNode[] };
		} = await shopifyRequest(client, ORDERS_QUERY, { after, query });
		timeZone = data.shop.ianaTimezone || timeZone;
		for (const o of data.orders.nodes) rows.push(toRow(o, timeZone, fulfilled));
		if (!data.orders.pageInfo.hasNextPage) break;
		after = data.orders.pageInfo.endCursor;
	}
	return rows;
}

// Each order costs up to two aliased fields (tagsAdd + tagsRemove), so 25
// orders keep a request at 50 fields.
const BATCH = 25;

const CONFIRMED_SPELLINGS = [...new Set([CONFIRMED_TAG, CONFIRMED_TAG.toLowerCase()])];

type UserErrors = { userErrors: { message: string }[] } | null | undefined;
const ok = (r: UserErrors) => !!r && r.userErrors.length === 0;

export interface MoveTarget {
	state: EasyConfirmTab;
	/** Required when state is 'between'. */
	reasonTag?: string;
	/** Required when reasonTag is the "Other" tag. */
	note?: string;
}

/**
 * Moves orders into one state. Every other state's tags are removed, so an
 * order is never Between and Confirmed at once. Moving back to pending removes
 * both spellings of the confirmed tag, which also clears orders confirmed via
 * the standalone app's lowercase tag.
 *
 * Returns the ids that failed, so a partial result can be reported.
 */
export async function moveOrders(client: ShopifyClient, ids: string[], target: MoveTarget): Promise<{ failed: string[] }> {
	const add =
		target.state === 'confirmed'
			? [CONFIRMED_TAG]
			: target.state === 'between' && target.reasonTag
				? [target.reasonTag]
				: [];
	// Compare case-insensitively: Shopify largely treats tag names that way, so
	// removing "confirmed" right after adding "Confirmed" could strip the tag
	// that was just added.
	const addLower = add.map((t) => t.toLowerCase());
	const remove = [...CONFIRMED_SPELLINGS, ...ALL_BETWEEN_TAGS].filter((t) => !addLower.includes(t.toLowerCase()));
	const failed = new Set<string>();

	for (let start = 0; start < ids.length; start += BATCH) {
		const chunk = ids.slice(start, start + BATCH);
		const varDefs = [
			...chunk.map((_, i) => `$id${i}: ID!`),
			'$remove: [String!]!',
			...(add.length ? ['$add: [String!]!'] : [])
		].join(', ');
		const fields = chunk
			.map((_, i) =>
				[
					add.length ? `a${i}: tagsAdd(id: $id${i}, tags: $add) { userErrors { message } }` : '',
					`r${i}: tagsRemove(id: $id${i}, tags: $remove) { userErrors { message } }`
				]
					.filter(Boolean)
					.join('\n')
			)
			.join('\n');
		const variables: Record<string, unknown> = { remove };
		if (add.length) variables.add = add;
		chunk.forEach((id, i) => (variables[`id${i}`] = id));

		try {
			const data = await shopifyRequest<Record<string, UserErrors>>(
				client,
				`mutation EasyConfirmMove(${varDefs}) {\n${fields}\n}`,
				variables
			);
			chunk.forEach((id, i) => {
				if (!ok(data[`r${i}`]) || (add.length > 0 && !ok(data[`a${i}`]))) failed.add(id);
			});
		} catch {
			chunk.forEach((id) => failed.add(id));
		}
	}

	// The typed "Other" text lives in a custom attribute: set it when moving to
	// Between > Other, clear it on any other move.
	const note =
		target.state === 'between' && target.reasonTag === BETWEEN_OTHER_TAG ? (target.note ?? '').trim() : '';
	const moved = ids.filter((id) => !failed.has(id));
	for (const id of await setBetweenNotes(client, moved, note)) failed.add(id);

	return { failed: [...failed] };
}

type OrderAttrs = { id: string; customAttributes: { key: string; value: string | null }[] };

/**
 * Sets (or clears, when `note` is empty) the Between-reason attribute while
 * keeping every other custom attribute intact — orderUpdate replaces the whole
 * list, so the current ones are read first. Orders that wouldn't change are
 * skipped. Returns the ids that failed.
 */
async function setBetweenNotes(client: ShopifyClient, ids: string[], note: string): Promise<string[]> {
	const failed: string[] = [];
	for (let start = 0; start < ids.length; start += BATCH) {
		const chunk = ids.slice(start, start + BATCH);

		let current: OrderAttrs[];
		try {
			const data = await shopifyRequest<{ nodes: (OrderAttrs | null)[] }>(
				client,
				`query EasyConfirmAttrs($ids: [ID!]!) { nodes(ids: $ids) { ... on Order { id customAttributes { key value } } } }`,
				{ ids: chunk }
			);
			current = data.nodes.filter((n): n is OrderAttrs => !!n);
		} catch {
			failed.push(...chunk);
			continue;
		}

		const updates = current.flatMap((o) => {
			const had = o.customAttributes.find((a) => a.key === BETWEEN_NOTE_KEY)?.value ?? '';
			if (had === note) return [];
			const others = o.customAttributes.filter((a) => a.key !== BETWEEN_NOTE_KEY);
			const next = note ? [...others, { key: BETWEEN_NOTE_KEY, value: note }] : others;
			return [{ id: o.id, customAttributes: next.map((a) => ({ key: a.key, value: a.value ?? '' })) }];
		});
		if (updates.length === 0) continue;

		const varDefs = updates.map((_, i) => `$in${i}: OrderInput!`).join(', ');
		const fields = updates.map((_, i) => `u${i}: orderUpdate(input: $in${i}) { userErrors { message } }`).join('\n');
		const variables: Record<string, unknown> = {};
		updates.forEach((u, i) => (variables[`in${i}`] = u));

		try {
			const data = await shopifyRequest<Record<string, UserErrors>>(
				client,
				`mutation EasyConfirmNotes(${varDefs}) {\n${fields}\n}`,
				variables
			);
			updates.forEach((u, i) => {
				if (!ok(data[`u${i}`])) failed.push(u.id);
			});
		} catch {
			failed.push(...updates.map((u) => u.id));
		}
	}
	return failed;
}

/** Full shipping-address update, including province/country codes. */
export async function updateEasyConfirmAddress(client: ShopifyClient, orderId: string, a: AddressFields): Promise<void> {
	const clean = (v: string | undefined) => (v ?? '').trim();
	const data = await shopifyRequest<{ orderUpdate: { userErrors: { field: string[] | null; message: string }[] } | null }>(
		client,
		`mutation EasyConfirmAddress($input: OrderInput!) {
			orderUpdate(input: $input) { userErrors { field message } }
		}`,
		{
			input: {
				id: orderId,
				shippingAddress: {
					firstName: clean(a.firstName),
					lastName: clean(a.lastName),
					company: clean(a.company),
					address1: clean(a.address1),
					address2: clean(a.address2),
					city: clean(a.city),
					provinceCode: clean(a.provinceCode) || null,
					zip: clean(a.zip),
					countryCode: clean(a.countryCode) || 'PK',
					phone: clean(a.phone)
				}
			}
		}
	);
	const errs = data.orderUpdate?.userErrors ?? [];
	if (!data.orderUpdate || errs.length > 0) throw new Error(errs[0]?.message ?? "Couldn't update address");
}
