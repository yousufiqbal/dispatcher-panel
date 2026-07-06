import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listCustomers } from '$lib/server/shopify/customers';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const session = locals.session;
	if (!session) throw error(401, 'Unauthorized');

	const q = url.searchParams.get('q')?.trim() ?? '';

	let shopifyDomain: string;
	let apiAccessToken: string;

	if (session.role === 'admin') {
		const store = await db.query.stores.findFirst({ where: eq(stores.id, params.storeId) });
		if (!store) throw error(404, 'Store not found');
		shopifyDomain = store.shopifyDomain;
		apiAccessToken = store.apiAccessToken;
	} else {
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
	// Shopify's free-text customer search matches name, email, and phone.
	const result = await listCustomers(client, { first: 10, query: q || undefined });
	return json(
		result.nodes.map((c) => ({
			id: c.id,
			displayName: c.displayName,
			email: c.email,
			phone: c.phone,
			numberOfOrders: c.numberOfOrders,
			defaultAddress: c.defaultAddress
		}))
	);
};
