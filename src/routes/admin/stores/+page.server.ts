import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const allStores = await db.select().from(stores).orderBy(desc(stores.createdAt));
	return { stores: allStores };
};
