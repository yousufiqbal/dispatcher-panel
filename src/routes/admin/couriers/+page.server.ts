import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, stores } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { COURIER_LABELS } from '$lib/server/courier';

export const load: PageServerLoad = async () => {
	const allCouriers = await db.select().from(couriers).orderBy(desc(couriers.createdAt));

	const allAccess = await db
		.select({ courierId: courierStoreAccess.courierId, storeId: courierStoreAccess.storeId })
		.from(courierStoreAccess);

	const allStores = await db.select({ id: stores.id, name: stores.name }).from(stores);
	const storeMap = new Map(allStores.map((s) => [s.id, s.name]));

	const couriersWithStores = allCouriers.map((c) => ({
		...c,
		providerLabel: COURIER_LABELS[c.provider],
		hasApiKey: !!c.apiKey,
		stores: allAccess.filter((a) => a.courierId === c.id).map((a) => storeMap.get(a.storeId) ?? a.storeId)
	}));

	return { couriers: couriersWithStores };
};
