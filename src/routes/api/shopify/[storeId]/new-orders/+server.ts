import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listOrders } from '$lib/server/shopify/orders';
import { getAuthorizedStore } from '$lib/server/store-access';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.session) throw error(401, 'Unauthorized');

	const since = url.searchParams.get('since');
	if (!since) throw error(400, 'Missing since');

	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	const result = await listOrders(client, { first: 10, query: `created_at:>'${since}'` });

	return json({
		orders: result.nodes.map((o) => ({
			id: o.id,
			name: o.name,
			customerName: o.customer?.displayName ?? 'Guest',
			total: o.totalPriceSet.shopMoney.amount,
			currency: o.totalPriceSet.shopMoney.currencyCode
		}))
	});
};
