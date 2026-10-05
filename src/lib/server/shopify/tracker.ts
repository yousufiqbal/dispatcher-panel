import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';
import { formatAddress, formatMoney, formatOrderDate, toInternationalDigits } from '$lib/easy-confirm';
import { LATE_AFTER_BUSINESS_DAYS, businessDaysSince, stageOf, type TrackerRow } from '$lib/tracker';

const ORDERS_QUERY = `
	query TrackerOrders($after: String, $query: String!) {
		shop { ianaTimezone }
		orders(first: 250, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
			pageInfo { hasNextPage endCursor }
			nodes {
				id
				legacyResourceId
				name
				createdAt
				cancelledAt
				displayFinancialStatus
				phone
				currentTotalPriceSet { shopMoney { amount currencyCode } }
				customer { displayName defaultPhoneNumber { phoneNumber } }
				shippingAddress { name address1 address2 city province zip country countryCodeV2 phone }
				fulfillments(first: 5) {
					createdAt
					status
					displayStatus
					trackingInfo(first: 1) { company number url }
				}
			}
		}
	}
`;

interface OrderNode {
	id: string;
	legacyResourceId: string;
	name: string;
	createdAt: string;
	cancelledAt: string | null;
	displayFinancialStatus: string | null;
	phone: string | null;
	currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null;
	customer: { displayName: string; defaultPhoneNumber: { phoneNumber: string } | null } | null;
	shippingAddress: {
		name: string | null;
		address1: string | null;
		address2: string | null;
		city: string | null;
		province: string | null;
		zip: string | null;
		country: string | null;
		countryCodeV2: string | null;
		phone: string | null;
	} | null;
	fulfillments: {
		createdAt: string;
		status: string;
		displayStatus: string | null;
		trackingInfo: { company: string | null; number: string | null; url: string | null }[];
	}[];
}

// Delivered or picked up: done. FAILURE / NOT_DELIVERED: the courier gave up
// and the parcel is coming back — it will never be delivered, so it isn't
// "in transit" and would make Late meaningless.
const FINISHED = new Set(['DELIVERED', 'PICKED_UP', 'CANCELED', 'FAILURE', 'NOT_DELIVERED']);

/**
 * Fulfilled, not cancelled, not yet delivered orders that carry a tracking
 * number, dispatched within the last `days` days, oldest dispatch first. The
 * page offers latest-first too, by reversing.
 *
 * There's no Shopify search filter for delivery status, so fulfilled orders
 * are fetched and filtered on each fulfillment's live displayStatus.
 */
export async function listTrackerOrders(client: ShopifyClient, days: number): Promise<TrackerRow[]> {
	// Pre-filter on order creation with a little slack: an order is always
	// created before it's dispatched, so this can't miss anything in the
	// window, and the exact dispatch-date cut happens below.
	const createdSince = new Date(Date.now() - (days + 14) * 86_400_000).toISOString().slice(0, 10);
	const query = `fulfillment_status:shipped -status:cancelled created_at:>=${createdSince}`;
	const dispatchCutoff = Date.now() - days * 86_400_000;

	const rows: TrackerRow[] = [];
	let after: string | null = null;
	let timeZone = 'UTC';
	const now = new Date();

	while (true) {
		const data: {
			shop: { ianaTimezone: string | null };
			orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: OrderNode[] };
		} = await shopifyRequest(client, ORDERS_QUERY, { after, query });
		timeZone = data.shop.ianaTimezone || timeZone;

		for (const o of data.orders.nodes) {
			if (o.cancelledAt) continue;
			const live = o.fulfillments.filter((f) => f.status !== 'CANCELLED');
			if (live.length === 0) continue;

			const displayStatus = live.find((f) => f.displayStatus)?.displayStatus ?? null;
			if (displayStatus && FINISHED.has(displayStatus)) continue;

			// Dispatch = first (earliest) live fulfillment.
			const dispatchedAt = live.map((f) => f.createdAt).sort()[0];
			if (Date.parse(dispatchedAt) < dispatchCutoff) continue;

			// Fulfilled without a tracking number means nothing to track — skip it.
			const tracking = live.flatMap((f) => f.trackingInfo).find((t) => t.number);
			if (!tracking) continue;
			const a = o.shippingAddress;
			const phone = a?.phone || o.phone || o.customer?.defaultPhoneNumber?.phoneNumber || '';
			const businessDays = businessDaysSince(dispatchedAt, timeZone, now);
			const total = o.currentTotalPriceSet;

			rows.push({
				id: o.id,
				legacyId: o.legacyResourceId,
				name: o.name,
				customer: o.customer?.displayName || a?.name || 'No customer',
				phone,
				phoneDigits: toInternationalDigits(phone, a?.countryCodeV2),
				street: [a?.address1, a?.address2].map((p) => p?.trim()).filter(Boolean).join(', '),
				address: formatAddress(a),
				city: a?.city || '',
				total: total ? formatMoney(total.shopMoney.amount, total.shopMoney.currencyCode) : '',
				financialStatus: o.displayFinancialStatus || '',
				displayStatus,
				courier: tracking.company || '',
				trackingNumber: tracking.number || '',
				trackingUrl: tracking.url || '',
				dispatchedAt,
				dispatchedLabel: formatOrderDate(dispatchedAt, timeZone, now),
				businessDays,
				stage: stageOf(displayStatus),
				late: businessDays >= LATE_AFTER_BUSINESS_DAYS
			});
		}

		if (!data.orders.pageInfo.hasNextPage) break;
		after = data.orders.pageInfo.endCursor;
	}

	return rows.sort((x, y) => x.dispatchedAt.localeCompare(y.dispatchedAt));
}
