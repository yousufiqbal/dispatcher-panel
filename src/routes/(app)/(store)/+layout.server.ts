import type { LayoutServerLoad } from './$types';

// Store pages read `currentStore` via parent() to build their Shopify client.
// The token stays encrypted here; the client factory decrypts it server-side.
export const load: LayoutServerLoad = async ({ locals }) => {
	const store = locals.store;
	return {
		currentStore: {
			id: store.id,
			name: store.name,
			logoUrl: store.iconUrl,
			shopifyDomain: store.shopifyDomain,
			apiAccessToken: store.apiAccessToken
		}
	};
};
