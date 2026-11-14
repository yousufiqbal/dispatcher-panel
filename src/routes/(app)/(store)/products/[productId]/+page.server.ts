import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getProduct } from '$lib/server/shopify/products';

function toShopifyProductId(id: string): string {
	return id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	try {
		const { product, currencyCode } = await getProduct(client, toShopifyProductId(params.productId));
		if (!product) throw error(404, 'Product not found');
		return { product, currencyCode };
	} catch {
		throw error(404, 'Product not found');
	}
};
