import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listCustomers } from '$lib/server/shopify/customers';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const q = url.searchParams.get('q') ?? '';
	const cursor = url.searchParams.get('after') ?? undefined;

	const result = await listCustomers(client, { first: 50, after: cursor, query: q || undefined });
	return { customers: result.nodes, pageInfo: result.pageInfo, q };
};
