import { error, fail, redirect, error as svelteError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getOrder, updateOrderShipping } from '$lib/server/shopify/orders';
import { searchProducts } from '$lib/server/shopify/draft-orders';
import { orderEditBegin, orderEditSetQuantity, orderEditAddVariant, orderEditAddDiscount, orderEditCommit } from '$lib/server/shopify/order-edit';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

function toGid(orderId: string) {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	try {
		const order = await getOrder(client, toGid(params.orderId));
		return { order };
	} catch {
		throw error(404, 'Order not found');
	}
};

export const actions: Actions = {
	// Save line item quantity changes + new products + discounts in one commit
	saveItems: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const orderId = toGid(params.orderId);

		// Quantities to update: lineItemId → qty
		const lineItemIds = fd.getAll('lineItemId') as string[];
		const quantities = fd.getAll('quantity') as string[];

		// New variants to add
		const newVariantIds = fd.getAll('newVariantId') as string[];
		const newQtys = fd.getAll('newQty') as string[];

		// Discount
		const discountLineItemId = fd.get('discountLineItemId') as string | null;
		const discountValue = parseFloat((fd.get('discountValue') as string) || '0');
		const discountType = (fd.get('discountType') as 'PERCENTAGE' | 'FIXED_AMOUNT') || 'PERCENTAGE';
		const discountDesc = (fd.get('discountDesc') as string) || 'Discount';

		try {
			const { calcOrderId: calcId, lineItems: calcLineItems } = await orderEditBegin(client, orderId);

			// Calc line items are in same order as original — map by index
			for (let i = 0; i < lineItemIds.length; i++) {
				const qty = parseInt(quantities[i] ?? '0', 10);
				const calcLineItemId = calcLineItems[i]?.id ?? lineItemIds[i];
				await orderEditSetQuantity(client, calcId, calcLineItemId, qty);
			}

			for (let i = 0; i < newVariantIds.length; i++) {
				if (!newVariantIds[i]) continue;
				const qty = parseInt(newQtys[i] ?? '1', 10);
				await orderEditAddVariant(client, calcId, newVariantIds[i], qty);
			}

			if (discountLineItemId && discountValue > 0) {
				const origIdx = lineItemIds.indexOf(discountLineItemId);
				const calcDiscountLineItemId = origIdx >= 0 ? (calcLineItems[origIdx]?.id ?? discountLineItemId) : discountLineItemId;
				await orderEditAddDiscount(client, calcId, calcDiscountLineItemId, {
					value: discountValue,
					valueType: discountType,
					description: discountDesc
				});
			}

			const notifyCustomer = fd.get('notifyCustomer') === 'true';
		await orderEditCommit(client, calcId, notifyCustomer, 'Edited by dispatcher');

			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.edit', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to save changes' });
		}

		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	},

	saveShipping: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		try {
			await updateOrderShipping(client, toGid(params.orderId), {
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
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update shipping' });
		}

		throw redirect(303, `/dashboard/stores/${params.storeId}/orders/${params.orderId}`);
	}
};
