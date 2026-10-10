import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listAllCollections } from '$lib/server/shopify/products';
import { fetchWeightProducts } from '$lib/server/shopify/weights';

export const load: PageServerLoad = async ({ parent }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const [products, collections] = await Promise.all([fetchWeightProducts(client), listAllCollections(client)]);
	return { products, collections };
};
