import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

function toDraftOrderId(id: string): string {
	return id.startsWith('gid://') ? id : `gid://shopify/DraftOrder/${id}`;
}

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);
	const gql = `
		query GetDraftOrder($id: ID!) {
			draftOrder(id: $id) {
				id legacyResourceId name createdAt updatedAt status totalPrice subtotalPrice
				customer { id displayName email phone }
				shippingAddress { name address1 city province country zip phone }
				lineItems(first: 50) {
					nodes {
						id title quantity originalUnitPrice
						variant { id title sku }
					}
				}
				note
			}
		}
	`;
	try {
		const data = await shopifyRequest<{ draftOrder: any }>(client, gql, { id: toDraftOrderId(params.draftId) });
		if (!data.draftOrder) throw error(404, 'Draft order not found');
		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'draftOrder.view', {
				targetType: 'draftOrder', targetId: params.draftId, storeId: params.storeId
			});
		}
		return { draft: data.draftOrder };
	} catch (e) {
		throw error(404, 'Draft order not found');
	}
};

export const actions: Actions = {
	complete: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const gql = `
			mutation draftOrderComplete($id: ID!) {
				draftOrderComplete(id: $id) {
					draftOrder { order { legacyResourceId } }
					userErrors { field message }
				}
			}
		`;
		try {
			const result = await shopifyRequest(client, gql, { id: toDraftOrderId(params.draftId) }) as any;
			const errors = result?.draftOrderComplete?.userErrors;
			if (errors?.length) return fail(400, { error: errors[0].message });
			const orderId = result?.draftOrderComplete?.draftOrder?.order?.legacyResourceId;
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'draftOrder.complete', { targetType: 'draftOrder', targetId: params.draftId, storeId: params.storeId });
			if (orderId) throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${orderId}`);
		} catch (e) {
			if ((e as any)?.status === 303) throw e;
			return fail(500, { error: e instanceof Error ? e.message : 'Failed to complete order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=drafts`);
	},

	delete: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const gql = `
			mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
				draftOrderDelete(input: $input) {
					deletedId
					userErrors { field message }
				}
			}
		`;
		try {
			const result = await shopifyRequest(client, gql, { input: { id: toDraftOrderId(params.draftId) } }) as any;
			const errors = result?.draftOrderDelete?.userErrors;
			if (errors?.length) return fail(400, { error: errors[0].message });
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'draftOrder.delete', { targetType: 'draftOrder', targetId: params.draftId, storeId: params.storeId });
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Failed to delete draft' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=drafts`);
	}
};
