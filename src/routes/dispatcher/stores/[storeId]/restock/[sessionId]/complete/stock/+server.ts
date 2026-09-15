import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { restockItems } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getVariantsAvailable } from '$lib/server/shopify/restock';

// Live Shopify `available` for every variant on this restock list, keyed by
// bare variant id. Fetched on demand when the dispatcher toggles "Show current
// stock" — a session may be days old by the time the order is placed.
export const GET: RequestHandler = async ({ params, locals }) => {
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	const rows = await db
		.select({ variantId: restockItems.variantId })
		.from(restockItems)
		.where(eq(restockItems.sessionId, params.sessionId));

	const stock = await getVariantsAvailable(client, [...new Set(rows.map((r) => r.variantId))]);
	return json(Object.fromEntries(stock));
};
