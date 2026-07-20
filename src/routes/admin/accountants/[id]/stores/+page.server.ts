import { redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { accountants, accountantStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const accountant = await db.query.accountants.findFirst({ where: eq(accountants.id, params.id) });
	if (!accountant) throw error(404, 'Accountant not found');

	const allStores = await db.select({ id: stores.id, name: stores.name, isActive: stores.isActive }).from(stores);

	const access = await db
		.select({ storeId: accountantStoreAccess.storeId })
		.from(accountantStoreAccess)
		.where(eq(accountantStoreAccess.accountantId, params.id));

	return {
		accountant: { id: accountant.id, name: accountant.name, email: accountant.email },
		stores: allStores,
		assignedStoreIds: access.map((a) => a.storeId)
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const storeIds = fd.getAll('storeIds') as string[];

		await db.delete(accountantStoreAccess).where(eq(accountantStoreAccess.accountantId, params.id));

		if (storeIds.length > 0) {
			await db.insert(accountantStoreAccess).values(
				storeIds.map((storeId) => ({ accountantId: params.id, storeId }))
			);
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'accountant.storeAccess.update', {
				targetType: 'accountant',
				targetId: params.id,
				metadata: { storeIds }
			});
		}

		throw redirect(303, `/admin/accountants/${params.id}`);
	}
};
