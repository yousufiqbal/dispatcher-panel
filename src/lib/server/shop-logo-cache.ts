import { getShopifyClient } from '$lib/server/shopify/client';
import { getShopLogoUrl } from '$lib/server/shopify/shop';

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { url: string | null; expiresAt: number }>();

export async function getCachedShopLogo(
	storeId: string,
	store: { shopifyDomain: string; apiAccessToken: string }
): Promise<string | null> {
	const cached = cache.get(storeId);
	if (cached && Date.now() < cached.expiresAt) return cached.url;

	const client = getShopifyClient(store);
	const url = await getShopLogoUrl(client);
	cache.set(storeId, { url, expiresAt: Date.now() + TTL_MS });
	return url;
}
