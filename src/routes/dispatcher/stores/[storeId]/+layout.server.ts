import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const session = locals.session!;

	const access = await db
		.select({
			storeId: dispatcherStoreAccess.storeId,
			name: stores.name,
			iconUrl: stores.iconUrl,
			shopifyDomain: stores.shopifyDomain,
			apiAccessToken: stores.apiAccessToken,
			isActive: stores.isActive
		})
		.from(dispatcherStoreAccess)
		.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
		.where(
			and(
				eq(dispatcherStoreAccess.dispatcherId, session.userId),
				eq(dispatcherStoreAccess.storeId, params.storeId),
				eq(stores.isActive, true)
			)
		);

	if (access.length === 0) {
		throw error(403, 'Access denied to this store');
	}

	const store = access[0];
	return {
		currentStore: {
			id: store.storeId,
			name: store.name,
			logoUrl: store.iconUrl,
			shopifyDomain: store.shopifyDomain,
			apiAccessToken: store.apiAccessToken // encrypted, will be decrypted in client factory
		}
	};
};
