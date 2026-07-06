import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const dispatcher = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, params.id) });
	if (!dispatcher) throw error(404, 'Dispatcher not found');

	const storeRows = await db
		.select({ id: stores.id, name: stores.name })
		.from(dispatcherStoreAccess)
		.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
		.where(eq(dispatcherStoreAccess.dispatcherId, params.id));

	return {
		dispatcher: { ...dispatcher, passwordHash: undefined },
		stores: storeRows
	};
};
