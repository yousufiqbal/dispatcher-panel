import { error } from '@sveltejs/kit';
import { getStore } from './store';
import type { SessionData } from './session';

// For form actions and API routes, which don't run the (app) layout's checks:
// a fully signed-in user (2FA cleared) and the connected store's credentials.
export async function getAuthorizedStore(session: SessionData | null) {
	if (!session) throw error(401, 'Unauthorized');
	// A session that has cleared the password but not the 2FA code is only
	// half-authenticated — it must not reach store data.
	if (!session.totpVerified) throw error(401, 'Two-factor authentication required');

	const store = await getStore();
	if (!store) throw error(503, 'No Shopify store is connected yet');
	return { storeId: store.id, name: store.name, shopifyDomain: store.shopifyDomain, apiAccessToken: store.apiAccessToken };
}
