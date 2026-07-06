import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, courierBookings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder } from '$lib/server/shopify/orders';
import { getAuthorizedStore } from '$lib/server/store-access';
import { decrypt } from '$lib/server/crypto';
import { bookShipment, getPostExOperationalCities } from '$lib/server/courier';
import { logAudit } from '$lib/server/audit';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

async function getAssignedCourier(courierId: string, storeId: string) {
	const [row] = await db
		.select({ courier: couriers })
		.from(courierStoreAccess)
		.innerJoin(couriers, eq(couriers.id, courierStoreAccess.courierId))
		.where(and(eq(courierStoreAccess.courierId, courierId), eq(courierStoreAccess.storeId, storeId)));
	return row?.courier ?? null;
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const courier = await getAssignedCourier(params.courierId, params.storeId);
	if (!courier) throw error(404, 'Courier not found or not assigned to this store');
	if (!courier.enabled) throw error(400, `${courier.name} is not enabled — enable it in Admin → Couriers`);

	const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
	if (ids.length === 0) throw error(400, 'No orders selected');

	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);
	const orders = await Promise.all(ids.map((id) => getOrder(client, toShopifyOrderId(id))));

	let cityWarnings: { orderName: string; city: string }[] = [];
	if (courier.provider === 'postex' && courier.apiKey) {
		try {
			const cities = await getPostExOperationalCities(decrypt(courier.apiKey));
			const supported = new Set(cities.filter((c) => c.isDeliveryCity).map((c) => c.operationalCityName.toLowerCase()));
			cityWarnings = orders
				.filter((o) => o.shippingAddress?.city && !supported.has(o.shippingAddress.city.toLowerCase()))
				.map((o) => ({ orderName: o.name, city: o.shippingAddress!.city }));
		} catch {
			// non-fatal — booking can still proceed without the city check
		}
	}

	return {
		courierId: courier.id,
		courierLabel: courier.name,
		orders,
		cityWarnings,
		defaults: {
			weight: courier.defaultWeight ?? '',
			fragile: courier.defaultFragile,
			note: courier.defaultNote ?? ''
		}
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const courier = await getAssignedCourier(params.courierId, params.storeId);
		if (!courier || !courier.enabled || !courier.apiKey) return fail(400, { error: 'Courier is not enabled' });

		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const apiKey = decrypt(courier.apiKey);

		const fd = await request.formData();
		const ids = (fd.get('ids') as string).split(',').filter(Boolean);
		const weight = (fd.get('weight') as string) ?? '';
		const codAmount = (fd.get('codAmount') as string) ?? '';
		const fragile = fd.get('fragile') === 'true';
		const note = (fd.get('note') as string) ?? '';

		const results: { orderName: string; trackingId: string }[] = [];

		for (const id of ids) {
			const order = await getOrder(client, toShopifyOrderId(id));
			const cod = codAmount.trim() || order.totalPriceSet.shopMoney.amount;

			try {
				const result = await bookShipment(courier.provider, apiKey, {
					orderName: order.name,
					weight: weight.trim() || '500',
					codAmount: cod,
					fragile,
					note,
					shippingAddress: order.shippingAddress
				});

				await db.insert(courierBookings).values({
					storeId: params.storeId,
					orderId: id,
					orderName: order.name,
					courierId: courier.id,
					provider: courier.provider,
					trackingId: result.trackingId,
					weight,
					codAmount: cod,
					fragile,
					note
				});

				if (locals.session) {
					await logAudit(locals.session.userId, 'dispatcher', 'order.courierBook', {
						targetType: 'order', targetId: id, storeId: params.storeId,
						metadata: { courier: courier.name, trackingId: result.trackingId }
					});
				}

				results.push({ orderName: order.name, trackingId: result.trackingId });
			} catch (e) {
				return fail(500, { error: `Failed to book ${order.name}: ${e instanceof Error ? e.message : 'Unknown error'}` });
			}
		}

		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=confirmed&booked=${results.length}`);
	}
};
