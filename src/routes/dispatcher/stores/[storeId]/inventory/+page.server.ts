import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listProductsWithInventory } from '$lib/server/shopify/products';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const q = url.searchParams.get('q') ?? '';
	const cursor = url.searchParams.get('after') ?? undefined;

	const result = await listProductsWithInventory(client, { first: 20, after: cursor, query: q || undefined });
	return { products: result.nodes, pageInfo: result.pageInfo, q };
};
