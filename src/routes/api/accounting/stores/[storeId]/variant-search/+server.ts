import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';
import { searchVariants } from '$lib/server/shopify/restock';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const store = await getAuthorizedAccountingStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	const q = url.searchParams.get('q')?.trim() ?? '';
	if (!q) return json({ results: [] });

	try {
		const results = await searchVariants(client, q);
		return json({ results });
	} catch (err) {
		console.error('[variant search failed]', err);
		return json({ results: [] });
	}
};
