import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listCustomers, createCustomer, updateCustomer } from '$lib/server/shopify/customers';
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

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const client = getShopifyClient(await resolveStoreCredentials(locals, params.storeId));
	// Shopify's free-text customer search matches name, email, and phone.
	const result = await listCustomers(client, { first: 10, query: q || undefined });
	return json(
		result.nodes.map((c) => ({
			id: c.id,
			displayName: c.displayName,
			firstName: c.firstName,
			lastName: c.lastName,
			email: c.email,
			phone: c.phone,
			numberOfOrders: c.numberOfOrders,
			defaultAddress: c.defaultAddress
		}))
	);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const session = locals.session;
	const client = getShopifyClient(await resolveStoreCredentials(locals, params.storeId));
	const body = await request.json();

	const firstName = (body.firstName ?? '').trim();
	const lastName = (body.lastName ?? '').trim();
	const email = (body.email ?? '').trim();
	const phone = (body.phone ?? '').trim();
	const address1 = (body.address1 ?? '').trim();
	const city = (body.city ?? '').trim();
	const province = (body.province ?? '').trim();
	const country = (body.country ?? '').trim();
	const zip = (body.zip ?? '').trim();

	if (!firstName) throw error(400, 'First name is required');

	try {
		const id = await createCustomer(client, {
			firstName,
			lastName,
			email: email || undefined,
			phone: phone || undefined,
			addresses: address1 ? [{ address1, city, province, country, zip }] : undefined
		});

		if (session) {
			await logAudit(session.userId, session.role, 'customer.create', {
				targetType: 'customer', targetId: id, storeId: params.storeId
			});
		}

		return json({
			id,
			displayName: [firstName, lastName].filter(Boolean).join(' '),
			firstName,
			lastName,
			email: email || null,
			phone: phone || null,
			numberOfOrders: 0,
			defaultAddress: address1 ? { address1, address2: null, city, province, country, zip, phone: phone || null } : null
		});
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to create customer');
	}
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const session = locals.session;
	const client = getShopifyClient(await resolveStoreCredentials(locals, params.storeId));
	const body = await request.json();

	const id = (body.id ?? '').trim();
	const firstName = (body.firstName ?? '').trim();
	const lastName = (body.lastName ?? '').trim();
	const email = (body.email ?? '').trim();
	const phone = (body.phone ?? '').trim();
	const address1 = (body.address1 ?? '').trim();
	const city = (body.city ?? '').trim();
	const province = (body.province ?? '').trim();
	const country = (body.country ?? '').trim();
	const zip = (body.zip ?? '').trim();

	if (!id) throw error(400, 'Customer id is required');
	if (!firstName) throw error(400, 'First name is required');

	try {
		await updateCustomer(client, {
			id,
			firstName,
			lastName,
			email: email || undefined,
			phone: phone || undefined,
			addresses: address1 ? [{ address1, city, province, country, zip }] : undefined
		});

		if (session) {
			await logAudit(session.userId, session.role, 'customer.update', {
				targetType: 'customer', targetId: id, storeId: params.storeId
			});
		}

		return json({
			id,
			displayName: [firstName, lastName].filter(Boolean).join(' '),
			firstName,
			lastName,
			email: email || null,
			phone: phone || null,
			numberOfOrders: 0,
			defaultAddress: address1 ? { address1, address2: null, city, province, country, zip, phone: phone || null } : null
		});
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to update customer');
	}
};
