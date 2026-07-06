import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores, dispatcherStoreAccess, dispatchers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const store = await db.query.stores.findFirst({ where: eq(stores.id, params.id) });
	if (!store) throw error(404, 'Store not found');

	const dispatcherRows = await db
		.select({ id: dispatchers.id, name: dispatchers.name })
		.from(dispatcherStoreAccess)
		.innerJoin(dispatchers, eq(dispatchers.id, dispatcherStoreAccess.dispatcherId))
		.where(eq(dispatcherStoreAccess.storeId, params.id));

	return {
		store: {
			id: store.id,
			name: store.name,
			iconUrl: store.iconUrl,
			shopifyDomain: store.shopifyDomain,
			oauthClientId: store.oauthClientId,
			hasOauthApp: !!store.oauthClientSecret,
			isActive: store.isActive,
			createdAt: store.createdAt,
			updatedAt: store.updatedAt
		},
		dispatchers: dispatcherRows
	};
};
