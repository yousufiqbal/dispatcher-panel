import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listProducts, getProductsCount } from '$lib/server/shopify/products';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const q = url.searchParams.get('q') ?? '';
	const cursor = url.searchParams.get('after') ?? undefined;

	// Only show live products — hide drafts and archived ones.
	const query = q ? `status:active (${q})` : 'status:active';

	const [result, totalCount] = await Promise.all([
		listProducts(client, { first: 30, after: cursor, query }),
		getProductsCount(client, { query: 'status:active' })
	]);
	return { products: result.nodes, pageInfo: result.pageInfo, q, totalCount };
};
