import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder, cancelOrder, fulfillOrder, refundOrder, updateOrderShipping } from '$lib/server/shopify/orders';
import { logAudit } from '$lib/server/audit';
import { getAuthorizedStore } from '$lib/server/store-access';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	console.log('[orderId param]', params.orderId);
	try {
		const order = await getOrder(client, toShopifyOrderId(params.orderId));
		return { order };
	} catch (e) {
		console.error('[getOrder failed]', e);
		throw error(404, 'Order not found');
	}
};

export const actions: Actions = {
	cancel: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const reason = (fd.get('reason') as string) || 'OTHER';
		const refund = fd.get('refund') === 'true';

		try {
			await cancelOrder(client, toShopifyOrderId(params.orderId), reason, refund);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.cancel', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId,
					metadata: { reason, refund }
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to cancel order' });
		}
		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	},

	fulfill: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const trackingNumber = (fd.get('trackingNumber') as string) || null;
		const trackingCompany = (fd.get('trackingCompany') as string) || null;

		try {
			await fulfillOrder(client, toShopifyOrderId(params.orderId), trackingNumber, trackingCompany);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.fulfill', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId,
					metadata: { trackingNumber, trackingCompany }
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to fulfill order' });
		}
		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	},

	refund: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const note = (fd.get('note') as string) || '';
		const lineItemIds = fd.getAll('lineItemId') as string[];
		const quantities = fd.getAll('quantity') as string[];

		const refundLineItems = lineItemIds.map((id, i) => ({
			lineItemId: id,
			quantity: parseInt(quantities[i] ?? '1', 10),
			restockType: 'NO_RESTOCK'
		}));

		try {
			await refundOrder(client, toShopifyOrderId(params.orderId), refundLineItems, false, note);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.refund', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to refund order' });
		}
		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	},

	updateShipping: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		try {
			await updateOrderShipping(client, toShopifyOrderId(params.orderId), {
				firstName: fd.get('firstName') as string,
				lastName: fd.get('lastName') as string,
				address1: fd.get('address1') as string,
				address2: (fd.get('address2') as string) || undefined,
				city: fd.get('city') as string,
				province: fd.get('province') as string,
				country: fd.get('country') as string,
				zip: fd.get('zip') as string,
				phone: (fd.get('phone') as string) || undefined
			});
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.updateShipping', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update shipping' });
		}
		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	}
};
