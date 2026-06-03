import { createAdminApiClient } from '@shopify/admin-api-client';
import { decrypt } from '$lib/server/crypto';

export type ShopifyClient = ReturnType<typeof createAdminApiClient>;

const clientCache = new Map<string, ShopifyClient>();

export function getShopifyClient(store: {
	shopifyDomain: string;
	apiAccessToken: string;
}): ShopifyClient {
	const key = `${store.shopifyDomain}:2025-07`;
	if (!clientCache.has(key)) {
		// Token is encrypted in DB (format iv:tag:data), plain if not yet stored
		const token = store.apiAccessToken.includes(':')
			? decrypt(store.apiAccessToken)
			: store.apiAccessToken;

		clientCache.set(
			key,
			createAdminApiClient({
				storeDomain: store.shopifyDomain,
				apiVersion: '2025-07',
				accessToken: token
			})
		);
	}
	return clientCache.get(key)!;
}

export function invalidateClient(shopifyDomain: string): void {
	clientCache.delete(shopifyDomain);
}

export class ShopifyApiError extends Error {
	constructor(public errors: unknown) {
		super('Shopify API error');
	}
}

export async function shopifyRequest<T>(
	client: ShopifyClient,
	query: string,
	variables?: Record<string, unknown>
): Promise<T> {
	const response = await client.request(query, { variables });
	if (response.errors) {
		const isMutation = query.trimStart().startsWith('mutation');
		// graphQLErrors is the array; response.errors may be a wrapper object
		const gqlErrors = (response.errors as { graphQLErrors?: { message?: string; extensions?: { code?: string } }[] }).graphQLErrors
			?? (Array.isArray(response.errors) ? response.errors as { message?: string; extensions?: { code?: string } }[] : []);
		const allAccessDenied = gqlErrors.length > 0 && gqlErrors.every(e => e.extensions?.code === 'ACCESS_DENIED');
		if (!isMutation && allAccessDenied && response.data) {
			console.warn('[Shopify partial error]', gqlErrors[0]?.message);
			return response.data as T;
		}
		console.error('[Shopify Error]', JSON.stringify(response.errors, null, 2));
		throw new ShopifyApiError(response.errors);
	}
	return response.data as T;
}
