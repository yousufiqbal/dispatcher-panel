import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder, confirmOrder, unconfirmOrder, updateOrderShipping } from '$lib/server/shopify/orders';
import { logAudit } from '$lib/server/audit';
import { getAuthorizedStore } from '$lib/server/store-access';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	try {
		const order = await getOrder(client, toShopifyOrderId(params.orderId));
		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.view', {
				targetType: 'order', targetId: params.orderId, storeId: params.storeId
			});
		}
		return { order };
	} catch (e) {
		throw error(404, 'Order not found');
	}
};

// Dispatchers only confirm/unconfirm orders and correct the shipping address
// here — payment, fulfillment, cancellation, refunds, edits and the rest are
// handled from the Shopify admin.
export const actions: Actions = {
	confirm: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		try {
			await confirmOrder(client, toShopifyOrderId(params.orderId));
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.confirm', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to confirm order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/confirmer`);
	},

	unconfirm: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		try {
			await unconfirmOrder(client, toShopifyOrderId(params.orderId));
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.unconfirm', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to unconfirm order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
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
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},
};
