import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listProducts, getProductsCount } from '$lib/server/shopify/products';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const q = url.searchParams.get('q') ?? '';
	const cursor = url.searchParams.get('after') ?? undefined;

	// Show live and draft products — hide only archived ones.
	const statusFilter = '(status:active OR status:draft)';
	const query = q ? `${statusFilter} (${q})` : statusFilter;

	const [result, totalCount] = await Promise.all([
		listProducts(client, { first: 30, after: cursor, query }),
		getProductsCount(client, { query: statusFilter })
	]);
	return { products: result.nodes, pageInfo: result.pageInfo, q, totalCount };
};
