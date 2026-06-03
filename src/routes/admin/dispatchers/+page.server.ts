import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const allDispatchers = await db.select().from(dispatchers).orderBy(desc(dispatchers.createdAt));

	// Load store access for each dispatcher
	const allAccess = await db
		.select({ dispatcherId: dispatcherStoreAccess.dispatcherId, storeId: dispatcherStoreAccess.storeId })
		.from(dispatcherStoreAccess);

	const allStores = await db.select({ id: stores.id, nickname: stores.nickname }).from(stores);
	const storeMap = new Map(allStores.map((s) => [s.id, s.nickname]));

	const dispatchersWithStores = allDispatchers.map((d) => ({
		...d,
		stores: allAccess
			.filter((a) => a.dispatcherId === d.id)
			.map((a) => storeMap.get(a.storeId) ?? a.storeId)
	}));

	return { dispatchers: dispatchersWithStores };
};
