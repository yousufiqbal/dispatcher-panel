import { getShopifyClient } from '$lib/server/shopify/client';
import { listOrders, CONFIRMED_TAG } from '$lib/server/shopify/orders';

const TTL_MS = 60_000;
const cache = new Map<string, { count: number; expiresAt: number }>();

export async function getCachedPendingCount(
	storeId: string,
	store: { shopifyDomain: string; apiAccessToken: string }
): Promise<number> {
	const cached = cache.get(storeId);
	if (cached && Date.now() < cached.expiresAt) return cached.count;

	const client = getShopifyClient(store);
	const result = await listOrders(client, { first: 100, query: 'fulfillment_status:unfulfilled status:open' });
	const count = result.nodes.filter((o) => !o.tags.includes(CONFIRMED_TAG)).length;

	cache.set(storeId, { count, expiresAt: Date.now() + TTL_MS });
	return count;
}
