import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedStore } from '$lib/server/store-access';
import { listOrders, phoneQueryVariants } from '$lib/server/shopify/orders';
import { listCustomers } from '$lib/server/shopify/customers';
import { listProducts } from '$lib/server/shopify/products';

export interface SearchSuggestion {
	id: string;
	title: string;
	subtitle: string;
	url: string;
}

const LIMIT = 8;

async function searchOrders(client: ReturnType<typeof getShopifyClient>, storeId: string, q: string): Promise<SearchSuggestion[]> {
	const phoneClauses = phoneQueryVariants(q).join(' OR ');
	const query = `(name:${q}* OR ${q}* OR ${phoneClauses})`;
	const { nodes } = await listOrders(client, { first: LIMIT, query });
	return nodes.map((o) => ({
		id: o.id,
		title: o.name,
		subtitle: o.customer?.displayName ?? o.shippingAddress?.name ?? 'Guest',
		url: `/dispatcher/stores/${storeId}/orders/${o.id.split('/').pop()}`
	}));
}

async function searchCustomers(client: ReturnType<typeof getShopifyClient>, storeId: string, q: string): Promise<SearchSuggestion[]> {
	const { nodes } = await listCustomers(client, { first: LIMIT, query: q });
	return nodes.map((c) => ({
		id: c.id,
		title: c.displayName,
		subtitle: c.phone ?? c.email ?? `${c.numberOfOrders} order${c.numberOfOrders === 1 ? '' : 's'}`,
		url: `/dispatcher/stores/${storeId}/customers/${c.id.split('/').pop()}`
	}));
}

async function searchProducts(client: ReturnType<typeof getShopifyClient>, storeId: string, q: string): Promise<SearchSuggestion[]> {
	const query = `(status:active OR status:draft) (title:${q}* OR ${q}*)`;
	const { nodes } = await listProducts(client, { first: LIMIT, query });
	return nodes.map((p) => ({
		id: p.id,
		title: p.title,
		subtitle: p.status.charAt(0) + p.status.slice(1).toLowerCase(),
		url: `/dispatcher/stores/${storeId}/products/${p.id.split('/').pop()}`
	}));
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	const q = url.searchParams.get('q')?.trim() ?? '';
	const scope = url.searchParams.get('scope') ?? 'orders';

	if (!q) return json({ results: [] });

	switch (scope) {
		case 'orders':
			return json({ results: await searchOrders(client, params.storeId, q) });
		case 'customers':
			return json({ results: await searchCustomers(client, params.storeId, q) });
		case 'products':
			return json({ results: await searchProducts(client, params.storeId, q) });
		default:
			throw error(400, 'Invalid scope');
	}
};
