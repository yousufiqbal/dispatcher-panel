import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores, dispatchers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

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

	const dispatcherUser = session.user as { role: 'dispatcher'; id: string; email: string; name: string; isActive: boolean };
	return {
		dispatcher: dispatcherUser,
		assignedStores: access.map((a) => ({
			id: a.storeId,
			name: a.name,
			shopifyDomain: a.shopifyDomain
		}))
	};
};
