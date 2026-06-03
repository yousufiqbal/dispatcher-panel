import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, stores, auditLog } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [allDispatchers, allStores, recentAudit] = await Promise.all([
		db.select().from(dispatchers),
		db.select().from(stores),
		db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(10)
	]);

	return {
		dispatcherCount: allDispatchers.length,
		activeDispatcherCount: allDispatchers.filter((d) => d.isActive).length,
		storeCount: allStores.length,
		activeStoreCount: allStores.filter((s) => s.isActive).length,
		recentAudit
	};
};
