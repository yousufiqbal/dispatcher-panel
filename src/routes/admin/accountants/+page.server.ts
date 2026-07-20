import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { accountants, accountantStoreAccess, stores } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const allAccountants = await db.select().from(accountants).orderBy(desc(accountants.createdAt));

	const allAccess = await db
		.select({ accountantId: accountantStoreAccess.accountantId, storeId: accountantStoreAccess.storeId })
		.from(accountantStoreAccess);

	const allStores = await db.select({ id: stores.id, name: stores.name }).from(stores);
	const storeMap = new Map(allStores.map((s) => [s.id, s.name]));

	const accountantsWithStores = allAccountants.map((a) => ({
		...a,
		stores: allAccess
			.filter((acc) => acc.accountantId === a.id)
			.map((acc) => storeMap.get(acc.storeId) ?? acc.storeId)
	}));

	return { accountants: accountantsWithStores };
};
