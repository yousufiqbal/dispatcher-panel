import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { searchProducts } from '$lib/server/shopify/draft-orders';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const session = locals.session;
	if (!session) throw error(401, 'Unauthorized');

	const q = url.searchParams.get('q') ?? '';
	let shopifyDomain: string;
	let apiAccessToken: string;

	if (session.role === 'admin') {
		// Admin can access any store directly
		const store = await db.query.stores.findFirst({ where: eq(stores.id, params.storeId) });
		if (!store) throw error(404, 'Store not found');
		shopifyDomain = store.shopifyDomain;
		apiAccessToken = store.apiAccessToken;
	} else {
		// Dispatcher: verify access
		const access = await db
			.select({ shopifyDomain: stores.shopifyDomain, apiAccessToken: stores.apiAccessToken })
			.from(dispatcherStoreAccess)
			.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
			.where(
				and(
					eq(dispatcherStoreAccess.dispatcherId, session.userId),
					eq(dispatcherStoreAccess.storeId, params.storeId)
				)
			);
		if (access.length === 0) throw error(403, 'Access denied');
		shopifyDomain = access[0].shopifyDomain;
		apiAccessToken = access[0].apiAccessToken;
	}

	const client = getShopifyClient({ shopifyDomain, apiAccessToken });
	const products = await searchProducts(client, q);
	return json(products);
};
