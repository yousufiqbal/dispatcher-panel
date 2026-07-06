import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SessionData } from './session';

export async function getAuthorizedStore(session: SessionData | null, storeId: string) {
	if (!session) throw error(401, 'Unauthorized');

	const access = await db
		.select({
			storeId: dispatcherStoreAccess.storeId,
			name: stores.name,
			shopifyDomain: stores.shopifyDomain,
			apiAccessToken: stores.apiAccessToken
		})
		.from(dispatcherStoreAccess)
		.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
		.where(
			and(
				eq(dispatcherStoreAccess.dispatcherId, session.userId),
				eq(dispatcherStoreAccess.storeId, storeId),
				eq(stores.isActive, true)
			)
		);

	if (access.length === 0) throw error(403, 'Access denied to this store');
	return access[0];
}
