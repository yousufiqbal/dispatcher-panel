import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { accountants, accountantStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const accountant = await db.query.accountants.findFirst({ where: eq(accountants.id, params.id) });
	if (!accountant) throw error(404, 'Accountant not found');

	const storeRows = await db
		.select({ id: stores.id, name: stores.name })
		.from(accountantStoreAccess)
		.innerJoin(stores, eq(stores.id, accountantStoreAccess.storeId))
		.where(eq(accountantStoreAccess.accountantId, params.id));

	return {
		accountant: { ...accountant, passwordHash: undefined },
		stores: storeRows
	};
};
