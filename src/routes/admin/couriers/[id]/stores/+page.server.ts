import { redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const courier = await db.query.couriers.findFirst({ where: eq(couriers.id, params.id) });
	if (!courier) throw error(404, 'Courier not found');

	const allStores = await db.select({ id: stores.id, name: stores.name, isActive: stores.isActive }).from(stores);

	const access = await db
		.select({ storeId: courierStoreAccess.storeId })
		.from(courierStoreAccess)
		.where(eq(courierStoreAccess.courierId, params.id));

	return {
		courier: { id: courier.id, name: courier.name },
		stores: allStores,
		assignedStoreIds: access.map((a) => a.storeId)
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const storeIds = fd.getAll('storeIds') as string[];

		await db.delete(courierStoreAccess).where(eq(courierStoreAccess.courierId, params.id));

		if (storeIds.length > 0) {
			await db.insert(courierStoreAccess).values(
				storeIds.map((storeId) => ({ courierId: params.id, storeId }))
			);
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'courier.storeAccess.update', {
				targetType: 'courier',
				targetId: params.id,
				metadata: { storeIds }
			});
		}

		throw redirect(303, `/admin/couriers/${params.id}`);
	}
};
