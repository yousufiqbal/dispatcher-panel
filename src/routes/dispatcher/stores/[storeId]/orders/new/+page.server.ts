import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { createDraftOrder, completeDraftOrder } from '$lib/server/shopify/draft-orders';
import { createCustomer } from '$lib/server/shopify/customers';
import { logAudit } from '$lib/server/audit';
import { getAuthorizedStore } from '$lib/server/store-access';

export const load: PageServerLoad = async () => ({ });

export const actions: Actions = {
	create: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		let customerId = (fd.get('customerId') as string | null)?.trim() || null;
		const note = fd.get('note') as string | null;
		const discountValue = fd.get('discountValue') as string | null;
		const discountType = fd.get('discountType') as 'PERCENTAGE' | 'FIXED_AMOUNT';

		const variantIds = fd.getAll('variantId') as string[];
		const quantities = fd.getAll('itemQuantity') as string[];
		const prices = fd.getAll('itemPrice') as string[];
		const titles = fd.getAll('itemTitle') as string[];

		const lineItems = variantIds
			.map((variantId, i) => ({
				variantId: variantId || undefined,
				title: variantId ? undefined : titles[i],
				price: variantId ? undefined : prices[i],
				quantity: parseInt(quantities[i] ?? '1', 10)
			}))
			.filter((item) => item.quantity > 0);

		if (lineItems.length === 0) {
			return fail(400, { error: 'At least one item is required' });
		}

		const shippingAddress = fd.get('ship_address1')
			? {
					firstName: fd.get('ship_firstName') as string,
					lastName: fd.get('ship_lastName') as string,
					address1: fd.get('ship_address1') as string,
					address2: (fd.get('ship_address2') as string) || undefined,
					city: fd.get('ship_city') as string,
					province: fd.get('ship_province') as string,
					country: fd.get('ship_country') as string,
					zip: fd.get('ship_zip') as string,
					phone: (fd.get('ship_phone') as string) || undefined
				}
			: undefined;

		// "New customer" mode — create the customer first, reusing the shipping
		// address as their default address when one was entered.
		const newFirstName = ((fd.get('cust_firstName') as string) ?? '').trim();
		if (!customerId && newFirstName) {
			try {
				customerId = await createCustomer(client, {
					firstName: newFirstName,
					lastName: ((fd.get('cust_lastName') as string) ?? '').trim(),
					email: ((fd.get('cust_email') as string) ?? '').trim() || undefined,
					phone: ((fd.get('cust_phone') as string) ?? '').trim() || undefined,
					addresses: shippingAddress
						? [{
								address1: shippingAddress.address1,
								city: shippingAddress.city,
								province: shippingAddress.province,
								country: shippingAddress.country,
								zip: shippingAddress.zip
							}]
						: undefined
				});
			} catch (e) {
				return fail(400, { error: `Failed to create customer: ${e instanceof Error ? e.message : 'Unknown error'}` });
			}
		}

		let orderId: string;
		try {
			const shippingCharge = parseFloat((fd.get('shippingCharge') as string) || '0');
			const draftOrder = await createDraftOrder(client, {
				lineItems,
				customerId: customerId || undefined,
				shippingAddress,
				note: note || undefined,
				shippingLine:
					shippingCharge > 0
						? { title: (fd.get('shippingTitle') as string)?.trim() || 'Shipping', price: shippingCharge.toFixed(2) }
						: undefined,
				appliedDiscount:
					discountValue && parseFloat(discountValue) > 0
						? { value: parseFloat(discountValue), valueType: discountType, title: 'Discount' }
						: undefined
			});

			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.draft.create', {
					targetType: 'draftOrder', targetId: draftOrder.id, storeId: params.storeId
				});
			}

			const completed = await completeDraftOrder(client, draftOrder.id);
			orderId = completed.orderId;
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to create order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${orderId.split('/').pop()}`);
	}
};
