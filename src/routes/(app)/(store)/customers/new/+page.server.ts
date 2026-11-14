import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { createCustomer } from '$lib/server/shopify/customers';
import { logAudit } from '$lib/server/audit';
import { getAuthorizedStore } from '$lib/server/store-access';

export const load: PageServerLoad = async () => ({ });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const store = await getAuthorizedStore(locals.session);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		const firstName = fd.get('firstName') as string;
		const lastName = fd.get('lastName') as string;
		const email = (fd.get('email') as string) || undefined;
		const phone = (fd.get('phone') as string) || undefined;

		if (!firstName || !lastName) {
			return fail(400, { error: 'First and last name are required' });
		}

		try {
			const customerId = await createCustomer(client, { firstName, lastName, email, phone });
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'customer.create', {
					targetType: 'customer', targetId: customerId, storeId: locals.store.id
				});
			}
			throw redirect(303, `/customers/${encodeURIComponent(customerId)}`);
		} catch (e) {
			if (e instanceof Response) throw e;
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to create customer' });
		}
	}
};
