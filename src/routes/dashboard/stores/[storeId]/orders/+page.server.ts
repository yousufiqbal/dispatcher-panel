import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listOrders } from '$lib/server/shopify/orders';

const STATUS_QUERIES: Record<string, string> = {
	pending: 'fulfillment_status:unfulfilled status:open',
	fulfilled: 'fulfillment_status:shipped',
	cancelled: 'status:cancelled',
	returned: 'financial_status:refunded',
	all: ''
};

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	const searchQ = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? 'all';
	const cursor = url.searchParams.get('after') ?? undefined;

	let shopifyQuery = STATUS_QUERIES[status] ?? '';
	if (searchQ) {
		// Search by order name, customer name, phone, or tracking
		const searchPart = `(name:*${searchQ}* OR customer_name:*${searchQ}* OR phone:*${searchQ}* OR tag:*${searchQ}*)`;
		shopifyQuery = shopifyQuery ? `${shopifyQuery} AND ${searchPart}` : searchPart;
	}

	const [result, pendingResult] = await Promise.all([
		listOrders(client, { first: 50, after: cursor, query: shopifyQuery || undefined }),
		listOrders(client, { first: 50, query: STATUS_QUERIES.pending || undefined })
	]);

	return {
		orders: result.nodes,
		pageInfo: result.pageInfo,
		searchQ,
		status,
		pendingCount: pendingResult.nodes.length
	};
};
