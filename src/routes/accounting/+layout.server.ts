import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { accountantStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = locals.session;

	if (!session || session.role !== 'accounting') {
		throw redirect(303, '/login');
	}

	const access = await db
		.select({
			storeId: accountantStoreAccess.storeId,
			name: stores.name,
			iconUrl: stores.iconUrl
		})
		.from(accountantStoreAccess)
		.innerJoin(stores, eq(stores.id, accountantStoreAccess.storeId))
		.where(
			and(
				eq(accountantStoreAccess.accountantId, session.userId),
				eq(stores.isActive, true)
			)
		);

	const accountantUser = session.user as { role: 'accounting'; id: string; email: string; name: string; isActive: boolean };
	return {
		accountant: accountantUser,
		assignedStores: access.map((a) => ({ id: a.storeId, name: a.name, logoUrl: a.iconUrl }))
	};
};
