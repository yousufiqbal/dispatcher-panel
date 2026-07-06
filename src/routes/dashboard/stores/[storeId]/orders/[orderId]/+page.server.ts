import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { getOrder, cancelOrder, confirmOrder, unconfirmOrder, fulfillOrder, refundOrder, updateOrderShipping } from '$lib/server/shopify/orders';
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
		throw redirect(303, `/dashboard/stores/${params.storeId}/orders?status=pending`);
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
	},

	markAsPaid: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const orderId = toShopifyOrderId(params.orderId);
		const gql = `
			mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
				orderMarkAsPaid(input: $input) {
					order { id }
					userErrors { field message }
				}
			}
		`;
		try {
			const data = await shopifyRequest<{ orderMarkAsPaid: { userErrors: { field: string[]; message: string }[] } }>(client, gql, { input: { id: orderId } });
			if (data.orderMarkAsPaid.userErrors.length) {
				return fail(400, { error: data.orderMarkAsPaid.userErrors.map(e => e.message).join(', ') });
			}
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'order.markAsPaid', { targetType: 'order', targetId: params.orderId, storeId: params.storeId });
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to mark as paid' });
		}
		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	},

	duplicateOrder: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const order = await getOrder(client, toShopifyOrderId(params.orderId));

		const lineItems = order.lineItems.nodes
			.filter(item => item.variant?.id)
			.map(item => ({ variantId: item.variant!.id, quantity: item.quantity }));

		if (!lineItems.length) return fail(400, { error: 'No duplicatable line items found' });

		const input: Record<string, unknown> = { lineItems };

		if (order.customer?.id) input.customerId = order.customer.id;

		if (order.shippingAddress) {
			const [firstName, ...rest] = order.shippingAddress.name.split(' ');
			input.shippingAddress = {
				firstName,
				lastName: rest.join(' '),
				address1: order.shippingAddress.address1,
				city: order.shippingAddress.city,
				province: order.shippingAddress.province,
				country: order.shippingAddress.country,
				zip: order.shippingAddress.zip,
				phone: order.shippingAddress.phone ?? undefined
			};
		}

		const gql = `
			mutation draftOrderCreate($input: DraftOrderInput!) {
				draftOrderCreate(input: $input) {
					draftOrder { id legacyResourceId }
					userErrors { field message }
				}
			}
		`;

		try {
			const result = await shopifyRequest(client, gql, { input }) as any;
			const errors = result?.draftOrderCreate?.userErrors;
			if (errors?.length) return fail(400, { error: errors[0].message });
			const newId = result?.draftOrderCreate?.draftOrder?.legacyResourceId;
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'order.duplicate', { targetType: 'order', targetId: params.orderId, storeId: params.storeId });
			if (newId) throw redirect(303, `/dashboard/stores/${params.storeId}/draft-orders/${newId}`);
		} catch (e) {
			if ((e as any)?.status === 303) throw e;
			return fail(500, { error: e instanceof Error ? e.message : 'Failed to duplicate order' });
		}
		return { success: true };
	},

	resendInvoice: async ({ params, locals, request }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const orderId = toShopifyOrderId(params.orderId);
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const gql = `
			mutation orderInvoiceSend($id: ID!, $email: EmailInput) {
				orderInvoiceSend(id: $id, email: $email) {
					order { id }
					userErrors { field message }
				}
			}
		`;
		try {
			const result = await shopifyRequest(client, gql, { id: orderId, email: { to: email } }) as any;
			const errors = result?.orderInvoiceSend?.userErrors;
			if (errors?.length) return fail(400, { error: errors[0].message });
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'order.resendInvoice', { targetType: 'order', targetId: params.orderId, storeId: params.storeId });
		} catch (e) {
			return fail(500, { error: 'Failed to send invoice' });
		}
		return { success: true };
	}
};
