import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listProducts, listAllCollections, getProductsCount } from '$lib/server/shopify/products';
import type { ProductNode } from '$lib/server/shopify/products';

// Product catalogs are small enough to show in full — walk every page up
// front so the list never needs a "Load more".
async function fetchAllProducts(client: ReturnType<typeof getShopifyClient>, query: string) {
	const all: ProductNode[] = [];
	let after: string | undefined;
	while (true) {
		const page = await listProducts(client, { first: 250, after, query });
		all.push(...page.nodes);
		if (!page.pageInfo.hasNextPage) break;
		after = page.pageInfo.endCursor;
	}
	return all;
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const q = url.searchParams.get('q') ?? '';

	// Show live and draft products — hide only archived ones.
	const statusFilter = '(status:active OR status:draft)';
	const query = q ? `${statusFilter} (${q})` : statusFilter;

	const [products, collections, totalCount] = await Promise.all([
		fetchAllProducts(client, query),
		listAllCollections(client),
		getProductsCount(client, { query: statusFilter })
	]);
	return { products, collections, q, totalCount };
};
