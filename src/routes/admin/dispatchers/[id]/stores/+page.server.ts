import { redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const dispatcher = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, params.id) });
	if (!dispatcher) throw error(404, 'Dispatcher not found');

	const allStores = await db.select({ id: stores.id, name: stores.name, isActive: stores.isActive }).from(stores);

	const access = await db
		.select({ storeId: dispatcherStoreAccess.storeId })
		.from(dispatcherStoreAccess)
		.where(eq(dispatcherStoreAccess.dispatcherId, params.id));

	return {
		dispatcher: { id: dispatcher.id, name: dispatcher.name, email: dispatcher.email },
		stores: allStores,
		assignedStoreIds: access.map((a) => a.storeId)
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const storeIds = fd.getAll('storeIds') as string[];

		await db.delete(dispatcherStoreAccess).where(eq(dispatcherStoreAccess.dispatcherId, params.id));

		if (storeIds.length > 0) {
			await db.insert(dispatcherStoreAccess).values(
				storeIds.map((storeId) => ({ dispatcherId: params.id, storeId }))
			);
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'dispatcher.storeAccess.update', {
				targetType: 'dispatcher',
				targetId: params.id,
				metadata: { storeIds }
			});
		}

		throw redirect(303, `/admin/dispatchers/${params.id}`);
	}
};
