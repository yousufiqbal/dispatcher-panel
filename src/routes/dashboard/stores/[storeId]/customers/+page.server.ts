import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listCustomers } from '$lib/server/shopify/customers';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ parent, url, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const q = url.searchParams.get('q') ?? '';
	const cursor = url.searchParams.get('after') ?? undefined;

	if (locals.session) {
		await logAudit(locals.session.userId, 'dispatcher', 'customers.list.view', { storeId: params.storeId });
	}

	const result = await listCustomers(client, { first: 50, after: cursor, query: q || undefined });
	return { customers: result.nodes, pageInfo: result.pageInfo, q };
};
