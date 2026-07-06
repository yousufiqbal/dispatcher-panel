import type { PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { listOrders, CONFIRMED_TAG } from '$lib/server/shopify/orders';

const STATUS_QUERIES: Record<string, string> = {
	pending: `fulfillment_status:unfulfilled status:open -tag:${CONFIRMED_TAG}`,
	confirmed: `fulfillment_status:unfulfilled status:open tag:${CONFIRMED_TAG}`,
	fulfilled: 'fulfillment_status:shipped',
	cancelled: 'status:cancelled',
	returned: 'financial_status:refunded',
	all: ''
};

// Builds Shopify search clauses that match a Pakistani mobile number regardless of
// how it was typed (leading 0, country code 92, +92, with/without dashes or spaces).
function phoneQueryVariants(raw: string): string[] {
	const digits = raw.replace(/\D/g, '');
	if (digits.length < 5) return [`phone:*${raw}*`];

	let national = digits; // number without leading 0 or country code, e.g. 3001234567
	if (digits.startsWith('0')) national = digits.slice(1);
	else if (digits.startsWith('92')) national = digits.slice(2);

	const variants = new Set([digits, national, `0${national}`, `92${national}`, `+92${national}`]);
	return [...variants].map((v) => `phone:*${v}*`);
}

async function listDraftOrders(client: ReturnType<typeof getShopifyClient>, { first = 50, after, query }: { first?: number; after?: string; query?: string } = {}) {
	const gql = `
		query ListDraftOrders($first: Int!, $after: String, $query: String) {
			draftOrders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
				nodes {
					id legacyResourceId name createdAt updatedAt
					status totalPrice
					customer { id displayName email phone }
					shippingAddress { city country }
					lineItems(first: 5) { nodes { quantity } }
				}
				pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
			}
		}
	`;
	const data = await shopifyRequest<{ draftOrders: { nodes: any[]; pageInfo: any } }>(client, gql, { first, after, query });
	return data.draftOrders;
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	const searchQ = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? 'all';
	const cursor = url.searchParams.get('after') ?? undefined;

	if (status === 'drafts') {
		const query = searchQ ? `name:*${searchQ}* OR customer_name:*${searchQ}*` : undefined;
		const [result, pendingResult, confirmedResult] = await Promise.all([
			listDraftOrders(client, { first: 30, after: cursor, query }),
			listOrders(client, { first: 50, query: STATUS_QUERIES.pending }),
			listOrders(client, { first: 50, query: STATUS_QUERIES.confirmed })
		]);
		return {
			orders: [],
			drafts: result.nodes,
			pageInfo: result.pageInfo,
			searchQ,
			status,
			pendingCount: pendingResult.nodes.length,
			confirmedCount: confirmedResult.nodes.length
		};
	}

	let shopifyQuery = STATUS_QUERIES[status] ?? '';
	if (searchQ) {
		const phoneClauses = phoneQueryVariants(searchQ).join(' OR ');
		const searchPart = `(name:*${searchQ}* OR customer_name:*${searchQ}* OR ${phoneClauses} OR tag:*${searchQ}*)`;
		shopifyQuery = shopifyQuery ? `${shopifyQuery} AND ${searchPart}` : searchPart;
	}

	const [result, pendingResult, confirmedResult] = await Promise.all([
		listOrders(client, { first: 30, after: cursor, query: shopifyQuery || undefined }),
		listOrders(client, { first: 50, query: STATUS_QUERIES.pending || undefined }),
		listOrders(client, { first: 50, query: STATUS_QUERIES.confirmed || undefined })
	]);

	return {
		orders: result.nodes,
		drafts: [],
		pageInfo: result.pageInfo,
		searchQ,
		status,
		pendingCount: pendingResult.nodes.length,
		confirmedCount: confirmedResult.nodes.length
	};
};
