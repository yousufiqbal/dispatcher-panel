import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedStore } from '$lib/server/store-access';
import { getProduct } from '$lib/server/shopify/products';

function toShopifyProductId(id: string): string {
	return id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);
	try {
		const { product, currencyCode } = await getProduct(client, toShopifyProductId(params.productId));
		if (!product) throw error(404, 'Product not found');
		return json({ product, currencyCode });
	} catch {
		throw error(404, 'Product not found');
	}
};
