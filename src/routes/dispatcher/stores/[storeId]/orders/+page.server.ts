import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { listOrders, confirmOrder, CONFIRMED_TAG } from '$lib/server/shopify/orders';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

async function getStoreCouriers(storeId: string) {
	return db
		.select({ id: couriers.id, name: couriers.name })
		.from(courierStoreAccess)
		.innerJoin(couriers, eq(couriers.id, courierStoreAccess.courierId))
		.where(and(eq(courierStoreAccess.storeId, storeId), eq(couriers.enabled, true)));
}

// `pending`/`confirmed` are NOT filtered by Shopify's tag: search (that's index-backed
// and lags a few seconds behind tag mutations — an order just confirmed would still
// show as pending). Instead we fetch all open+unfulfilled orders and split them by
// their live `tags` field, which reflects the tag mutation instantly.
const STATUS_QUERIES: Record<string, string> = {
	pending: 'fulfillment_status:unfulfilled status:open',
	confirmed: 'fulfillment_status:unfulfilled status:open',
	fulfilled: 'fulfillment_status:shipped',
	cancelled: 'status:cancelled',
	returned: 'financial_status:refunded',
	all: ''
};

// Builds Shopify search clauses that match a Pakistani mobile number regardless of
// how it was typed (leading 0, country code 92, +92, with/without dashes or spaces).
function phoneQueryVariants(raw: string): string[] {
	const digits = raw.replace(/\D/g, '');
	if (digits.length < 5) return [`phone:*${raw}*`];

	let national = digits; // number without leading 0 or country code, e.g. 3001234567
	if (digits.startsWith('0')) national = digits.slice(1);
	else if (digits.startsWith('92')) national = digits.slice(2);

	const variants = new Set([digits, national, `0${national}`, `92${national}`, `+92${national}`]);
	return [...variants].map((v) => `phone:*${v}*`);
}

async function listDraftOrders(client: ReturnType<typeof getShopifyClient>, { first = 50, after, query }: { first?: number; after?: string; query?: string } = {}) {
	const gql = `
		query ListDraftOrders($first: Int!, $after: String, $query: String) {
			draftOrders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
				nodes {
					id legacyResourceId name createdAt updatedAt
					status totalPrice
					customer { id displayName email phone }
					shippingAddress { city country }
					lineItems(first: 5) { nodes { quantity } }
				}
				pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
			}
		}
	`;
	const data = await shopifyRequest<{ draftOrders: { nodes: any[]; pageInfo: any } }>(client, gql, { first, after, query });
	return data.draftOrders;
}

async function getBadgeCounts(client: ReturnType<typeof getShopifyClient>) {
	const openUnfulfilled = await listOrders(client, { first: 100, query: STATUS_QUERIES.pending });
	const pendingCount = openUnfulfilled.nodes.filter((o) => !o.tags.includes(CONFIRMED_TAG)).length;
	const confirmedCount = openUnfulfilled.nodes.filter((o) => o.tags.includes(CONFIRMED_TAG)).length;
	return { pendingCount, confirmedCount };
}

export const load: PageServerLoad = async ({ parent, url, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	const searchQ = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? 'all';
	const cursor = url.searchParams.get('after') ?? undefined;

	if (locals.session) {
		await logAudit(locals.session.userId, 'dispatcher', 'orders.list.view', { storeId: params.storeId, metadata: { status } });
	}

	if (status === 'drafts') {
		const query = searchQ ? `name:*${searchQ}* OR customer_name:*${searchQ}*` : undefined;
		const [result, badgeCounts, couriers] = await Promise.all([
			listDraftOrders(client, { first: 30, after: cursor, query }),
			getBadgeCounts(client),
			getStoreCouriers(params.storeId)
		]);
		return {
			orders: [],
			drafts: result.nodes,
			pageInfo: result.pageInfo,
			searchQ,
			status,
			...badgeCounts,
			couriers
		};
	}

	const isTagFiltered = status === 'pending' || status === 'confirmed';

	let shopifyQuery = STATUS_QUERIES[status] ?? '';
	if (searchQ) {
		const phoneClauses = phoneQueryVariants(searchQ).join(' OR ');
		const searchPart = `(name:*${searchQ}* OR customer_name:*${searchQ}* OR ${phoneClauses} OR tag:*${searchQ}*)`;
		shopifyQuery = shopifyQuery ? `${shopifyQuery} AND ${searchPart}` : searchPart;
	}

	// Fetch extra when tag-filtering client-side, since some fetched orders get
	// dropped by the tag split below (pagination becomes approximate as a result).
	const [result, badgeCounts, couriers] = await Promise.all([
		listOrders(client, { first: isTagFiltered ? 60 : 30, after: cursor, query: shopifyQuery || undefined }),
		getBadgeCounts(client),
		getStoreCouriers(params.storeId)
	]);

	let orders = result.nodes;
	if (status === 'pending') orders = orders.filter((o) => !o.tags.includes(CONFIRMED_TAG));
	else if (status === 'confirmed') orders = orders.filter((o) => o.tags.includes(CONFIRMED_TAG));

	return {
		orders,
		drafts: [],
		pageInfo: result.pageInfo,
		searchQ,
		status,
		...badgeCounts,
		couriers
	};
};

export const actions: Actions = {
	bulkConfirm: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const ids = (fd.get('ids') as string).split(',').filter(Boolean);

		try {
			await Promise.all(ids.map((id) => confirmOrder(client, id.startsWith('gid://') ? id : `gid://shopify/Order/${id}`)));
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.bulkConfirm', {
					targetType: 'order', storeId: params.storeId, metadata: { count: ids.length }
				});
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to confirm orders' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=pending`);
	}
};
