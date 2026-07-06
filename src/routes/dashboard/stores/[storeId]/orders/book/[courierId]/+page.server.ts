import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { courierSettings, courierBookings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder } from '$lib/server/shopify/orders';
import { getAuthorizedStore } from '$lib/server/store-access';
import { decrypt } from '$lib/server/crypto';
import { bookShipment, COURIER_LABELS, type CourierCode } from '$lib/server/courier';
import { logAudit } from '$lib/server/audit';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

function isCourierCode(v: string): v is CourierCode {
	return v === 'postex' || v === 'dex';
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!isCourierCode(params.courier)) throw error(404, 'Unknown courier');

	const settings = await db.query.courierSettings.findFirst({ where: eq(courierSettings.courier, params.courier) });
	if (!settings?.enabled) throw error(400, `${COURIER_LABELS[params.courier]} is not enabled — set it up in Admin Settings`);

	const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
	if (ids.length === 0) throw error(400, 'No orders selected');

	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);
	const orders = await Promise.all(ids.map((id) => getOrder(client, toShopifyOrderId(id))));

	return {
		courier: params.courier,
		courierLabel: COURIER_LABELS[params.courier],
		orders,
		defaults: {
			weight: settings.defaultWeight ?? '',
			fragile: settings.defaultFragile,
			note: settings.defaultNote ?? ''
		}
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		if (!isCourierCode(params.courier)) throw error(404, 'Unknown courier');

		const settings = await db.query.courierSettings.findFirst({ where: eq(courierSettings.courier, params.courier) });
		if (!settings?.enabled || !settings.apiKey) return fail(400, { error: 'Courier is not enabled' });

		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const apiKey = decrypt(settings.apiKey);

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
				const result = await bookShipment(params.courier, apiKey, {
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
					courier: params.courier,
					trackingId: result.trackingId,
					weight,
					codAmount: cod,
					fragile,
					note
				});

				if (locals.session) {
					await logAudit(locals.session.userId, 'dispatcher', 'order.courierBook', {
						targetType: 'order', targetId: id, storeId: params.storeId,
						metadata: { courier: params.courier, trackingId: result.trackingId }
					});
				}

				results.push({ orderName: order.name, trackingId: result.trackingId });
			} catch (e) {
				return fail(500, { error: `Failed to book ${order.name}: ${e instanceof Error ? e.message : 'Unknown error'}` });
			}
		}

		throw redirect(303, `/dashboard/stores/${params.storeId}/orders?status=confirmed&booked=${results.length}`);
	}
};
