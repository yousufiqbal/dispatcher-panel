import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder } from '$lib/server/shopify/orders';
import { getAuthorizedStore } from '$lib/server/store-access';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	try {
		const order = await getOrder(client, toShopifyOrderId(params.orderId));
		return { order, storeName: store.name };
	} catch {
		throw error(404, 'Order not found');
	}
};
