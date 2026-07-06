import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores, dispatchers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCachedPendingCount } from '$lib/server/pending-count-cache';
import { getCachedShopLogo } from '$lib/server/shop-logo-cache';

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = locals.session;

	if (!session || session.role !== 'dispatcher') {
		throw redirect(303, '/login');
	}

	const access = await db
		.select({
			storeId: dispatcherStoreAccess.storeId,
			name: stores.name,
			shopifyDomain: stores.shopifyDomain,
			apiAccessToken: stores.apiAccessToken,
			isActive: stores.isActive
		})
		.from(dispatcherStoreAccess)
		.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
		.where(
			and(
				eq(dispatcherStoreAccess.dispatcherId, session.userId),
				eq(stores.isActive, true)
			)
		);

	// Cached, so switching/reloading pages doesn't hammer Shopify.
	const [pendingCounts, logoUrls] = await Promise.all([
		Promise.all(access.map((a) => getCachedPendingCount(a.storeId, a).catch(() => 0))),
		Promise.all(access.map((a) => getCachedShopLogo(a.storeId, a).catch(() => null)))
	]);

	const dispatcherUser = session.user as { role: 'dispatcher'; id: string; email: string; name: string; isActive: boolean };
	return {
		dispatcher: dispatcherUser,
		assignedStores: access.map((a, i) => ({
			id: a.storeId,
			name: a.name,
			shopifyDomain: a.shopifyDomain,
			pendingCount: pendingCounts[i],
			logoUrl: logoUrls[i]
		}))
	};
};
