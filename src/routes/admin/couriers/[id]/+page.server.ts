import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { COURIER_LABELS } from '$lib/server/courier';

export const load: PageServerLoad = async ({ params }) => {
	const courier = await db.query.couriers.findFirst({ where: eq(couriers.id, params.id) });
	if (!courier) throw error(404, 'Courier not found');

	const storeRows = await db
		.select({ id: stores.id, name: stores.name })
		.from(courierStoreAccess)
		.innerJoin(stores, eq(stores.id, courierStoreAccess.storeId))
		.where(eq(courierStoreAccess.courierId, params.id));

	return {
		courier: {
			id: courier.id,
			name: courier.name,
			provider: courier.provider,
			providerLabel: COURIER_LABELS[courier.provider],
			enabled: courier.enabled,
			hasApiKey: !!courier.apiKey,
			defaultWeight: courier.defaultWeight,
			defaultFragile: courier.defaultFragile,
			defaultNote: courier.defaultNote,
			createdAt: courier.createdAt
		},
		stores: storeRows
	};
};
