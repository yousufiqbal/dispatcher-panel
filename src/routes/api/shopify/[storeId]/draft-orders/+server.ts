import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { createDraftOrder, completeDraftOrder, type DraftOrderInput } from '$lib/server/shopify/draft-orders';
import { logAudit } from '$lib/server/audit';

async function resolveStoreCredentials(locals: App.Locals, storeId: string) {
	const session = locals.session;
	if (!session) throw error(401, 'Unauthorized');

	if (session.role === 'admin') {
		const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
		if (!store) throw error(404, 'Store not found');
		return { shopifyDomain: store.shopifyDomain, apiAccessToken: store.apiAccessToken };
	}

	const access = await db
		.select({ shopifyDomain: stores.shopifyDomain, apiAccessToken: stores.apiAccessToken })
		.from(dispatcherStoreAccess)
		.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
		.where(and(eq(dispatcherStoreAccess.dispatcherId, session.userId), eq(dispatcherStoreAccess.storeId, storeId)));
	if (access.length === 0) throw error(403, 'Access denied');
	return { shopifyDomain: access[0].shopifyDomain, apiAccessToken: access[0].apiAccessToken };
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const session = locals.session;
	const client = getShopifyClient(await resolveStoreCredentials(locals, params.storeId));
	const body = await request.json();

	const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
	if (lineItems.length === 0) throw error(400, 'At least one line item is required');

	const input: DraftOrderInput = {
		lineItems,
		customerId: body.customerId || undefined,
		shippingAddress: body.shippingAddress || undefined,
		shippingLine: body.shippingLine || undefined,
		appliedDiscount: body.appliedDiscount || undefined,
		note: body.note || undefined
	};

	try {
		const draftOrder = await createDraftOrder(client, input);

		if (!body.complete) {
			if (session) {
				await logAudit(session.userId, session.role, 'draftOrder.create', {
					targetType: 'draftOrder', targetId: draftOrder.id, storeId: params.storeId
				});
			}
			return json({ draftOrderId: draftOrder.id, draftOrderName: draftOrder.name });
		}

		const completed = await completeDraftOrder(client, draftOrder.id, Boolean(body.paymentPending));
		if (session) {
			await logAudit(session.userId, session.role, 'order.create', {
				targetType: 'order', targetId: completed.orderId, storeId: params.storeId
			});
		}
		return json({ orderId: completed.orderId, orderName: completed.orderName });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to create order');
	}
};
