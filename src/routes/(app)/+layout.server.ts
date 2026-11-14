import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getCachedPendingCount } from '$lib/server/pending-count-cache';
import { getCachedShopLogo } from '$lib/server/shop-logo-cache';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = locals.session;

	// 2FA is mandatory — an unverified session has passed the password check
	// only, so send it back to finish (or set up) the code step.
	if (!session || session.role !== 'dispatcher' || !session.totpVerified) {
		throw redirect(303, '/login');
	}

	// The Shopify connection comes from the deployment's environment; Team and
	// Activity still open without it so the owner isn't locked out.
	const store = locals.store;
	if (!store) {
		if (!session.user.isOwner || !['/team', '/activity'].includes(url.pathname)) {
			error(503, 'This panel has no Shopify store configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in the environment.');
		}
		return { dispatcher: session.user, store: null };
	}

	// Cached, so moving between pages doesn't hammer Shopify. A custom-uploaded
	// store icon always wins over Shopify's own shop logo.
	const [pendingCount, logoUrl] = await Promise.all([
		getCachedPendingCount(store.id, store).catch(() => 0),
		store.iconUrl ? Promise.resolve(store.iconUrl) : getCachedShopLogo(store.id, store).catch(() => null)
	]);

	return {
		dispatcher: session.user,
		store: { id: store.id, name: store.name, shopifyDomain: store.shopifyDomain, pendingCount, logoUrl }
	};
};
