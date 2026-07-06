import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getCustomer, updateCustomer } from '$lib/server/shopify/customers';
import { logAudit } from '$lib/server/audit';
import { getAuthorizedStore } from '$lib/server/store-access';

function toShopifyCustomerId(id: string): string {
	return id.startsWith('gid://') ? id : `gid://shopify/Customer/${id}`;
}

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	try {
		const customer = await getCustomer(client, toShopifyCustomerId(params.customerId));
		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'customer.view', {
				targetType: 'customer', targetId: params.customerId, storeId: params.storeId
			});
		}
		return { customer };
	} catch {
		throw error(404, 'Customer not found');
	}
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		try {
			await updateCustomer(client, {
				id: toShopifyCustomerId(params.customerId),
				firstName: (fd.get('firstName') as string) || undefined,
				lastName: (fd.get('lastName') as string) || undefined,
				email: (fd.get('email') as string) || undefined,
				phone: (fd.get('phone') as string) || undefined
			});
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'customer.update', {
					targetType: 'customer', targetId: params.customerId, storeId: params.storeId
				});
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update customer' });
		}

		return { success: true };
	}
};
