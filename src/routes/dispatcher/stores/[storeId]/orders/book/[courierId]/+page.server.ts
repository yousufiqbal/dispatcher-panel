import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, courierBookings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder, fulfillOrder, CONFIRMED_TAG } from '$lib/server/shopify/orders';
import { getAuthorizedStore } from '$lib/server/store-access';
import { decrypt } from '$lib/server/crypto';
import { bookShipment, getPostExOperationalCities, getPostExPickupAddresses, COURIER_LABELS, type PickupAddress } from '$lib/server/courier';
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
	let pickupAddresses: PickupAddress[] = [];
	if (courier.provider === 'postex' && courier.apiKey) {
		const apiKey = decrypt(courier.apiKey);
		try {
			const cities = await getPostExOperationalCities(apiKey);
			const supported = new Set(cities.filter((c) => c.isDeliveryCity).map((c) => c.operationalCityName.toLowerCase()));
			cityWarnings = orders
				.filter((o) => o.shippingAddress?.city && !supported.has(o.shippingAddress.city.toLowerCase()))
				.map((o) => ({ orderName: o.name, city: o.shippingAddress!.city }));
		} catch {
			// non-fatal — booking can still proceed without the city check
		}
		try {
			pickupAddresses = await getPostExPickupAddresses(apiKey);
		} catch {
			// non-fatal — surfaced to the dispatcher as "no pickup address" if list is empty
		}
	}

	const rows = orders.map((o) => ({
		id: o.id.split('/').pop()!,
		orderName: o.name,
		confirmed: o.tags.includes(CONFIRMED_TAG),
		customerName: o.shippingAddress?.name ?? o.customer?.displayName ?? '',
		customerPhone: o.shippingAddress?.phone ?? '',
		address1: o.shippingAddress?.address1 ?? '',
		city: o.shippingAddress?.city ?? '',
		codAmount: o.totalPriceSet.shopMoney.amount,
		weight: courier.defaultWeight ?? '500',
		fragile: courier.defaultFragile,
		note: courier.defaultNote ?? '',
		itemsDetail: o.lineItems.nodes.map((li) => `${li.title} x${li.quantity}`).join(', '),
		itemsCount: o.lineItems.nodes.reduce((sum, li) => sum + li.quantity, 0) || 1
	}));

	return {
		courierId: courier.id,
		courierLabel: courier.name,
		provider: courier.provider,
		rows,
		cityWarnings,
		pickupAddresses
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
		const pickupAddressCode = ((fd.get('pickupAddressCode') as string) ?? '').trim();

		if (courier.provider === 'postex' && !pickupAddressCode) {
			return fail(400, { error: 'Select a pickup address before booking' });
		}

		const results: { orderName: string; trackingId: string }[] = [];

		for (const id of ids) {
			const order = await getOrder(client, toShopifyOrderId(id));

			const customerName = ((fd.get(`customerName_${id}`) as string) ?? '').trim() || order.shippingAddress?.name || '';
			const customerPhone = ((fd.get(`customerPhone_${id}`) as string) ?? '').trim() || order.shippingAddress?.phone || '';
			const address1 = ((fd.get(`address1_${id}`) as string) ?? '').trim() || order.shippingAddress?.address1 || '';
			const city = ((fd.get(`city_${id}`) as string) ?? '').trim() || order.shippingAddress?.city || '';
			const codAmount = ((fd.get(`codAmount_${id}`) as string) ?? '').trim() || order.totalPriceSet.shopMoney.amount;
			const weight = ((fd.get(`weight_${id}`) as string) ?? '').trim() || '500';
			const fragile = fd.get(`fragile_${id}`) === 'true';
			const note = ((fd.get(`note_${id}`) as string) ?? '').trim();
			const orderDetail = ((fd.get(`itemsDetail_${id}`) as string) ?? '').trim();
			const items = parseInt((fd.get(`itemsCount_${id}`) as string) ?? '', 10) || 1;

			const shippingAddress = order.shippingAddress
				? { ...order.shippingAddress, name: customerName, phone: customerPhone, address1, city }
				: null;

			try {
				const result = await bookShipment(courier.provider, apiKey, {
					orderName: order.name,
					weight,
					codAmount,
					fragile,
					note,
					orderDetail,
					items,
					pickupAddressCode,
					shippingAddress
				});

				await db.insert(courierBookings).values({
					storeId: params.storeId,
					orderId: id,
					orderName: order.name,
					courierId: courier.id,
					provider: courier.provider,
					trackingId: result.trackingId,
					weight,
					codAmount,
					fragile,
					note
				});

				if (locals.session) {
					await logAudit(locals.session.userId, 'dispatcher', 'order.courierBook', {
						targetType: 'order', targetId: id, storeId: params.storeId,
						metadata: { courier: courier.name, trackingId: result.trackingId }
					});
				}

				// Booking a courier shipment should mark the order fulfilled in Shopify too —
				// non-fatal if this fails, since the shipment itself is already booked with
				// the courier; the dispatcher can still fulfill manually from the order page.
				try {
					await fulfillOrder(client, toShopifyOrderId(id), result.trackingId, COURIER_LABELS[courier.provider]);
					if (locals.session) {
						await logAudit(locals.session.userId, 'dispatcher', 'order.fulfill', {
							targetType: 'order', targetId: id, storeId: params.storeId,
							metadata: { trackingNumber: result.trackingId, trackingCompany: COURIER_LABELS[courier.provider] }
						});
					}
				} catch (fulfillErr) {
					console.error('[auto-fulfill after booking failed]', order.name, fulfillErr);
				}

				results.push({ orderName: order.name, trackingId: result.trackingId });
			} catch (e) {
				return fail(500, { error: `Failed to book ${order.name}: ${e instanceof Error ? e.message : 'Unknown error'}` });
			}
		}

		// `labels` triggers an automatic airway-bill PDF download on the orders page.
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=fulfilled&booked=${results.length}&labels=${ids.join(',')}`);
	}
};
