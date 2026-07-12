import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { listOrders, getTagSplitCounts, confirmOrder, cancelOrder, getOrder, CONFIRMED_TAG } from '$lib/server/shopify/orders';
import { orderEditBegin, orderEditAddVariant, orderEditAddCustomItem, orderEditCommit } from '$lib/server/shopify/order-edit';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

async function getStoreCouriers(storeId: string) {
	return db
		.select({ id: couriers.id, name: couriers.name })
		.from(courierStoreAccess)
		.innerJoin(couriers, eq(couriers.id, courierStoreAccess.courierId))
		.where(and(eq(courierStoreAccess.storeId, storeId), eq(couriers.enabled, true)));
}

// Shopify's Fulfillment.displayStatus — the same field the Shopify admin's
// "Delivery status" column shows. The courier pushes status events to Shopify,
// so reading it here costs nothing extra (already part of the orders query).
function orderDisplayStatus(o: { fulfillments: { displayStatus: string | null }[] }): string | null {
	return o.fulfillments.find((f) => f.displayStatus)?.displayStatus ?? null;
}

// `pending`/`confirmed` are NOT filtered by Shopify's tag: search (that's index-backed
// and lags a few seconds behind tag mutations — an order just confirmed would still
// show as pending). Instead we fetch all open+unfulfilled orders and split them by
// their live `tags` field, which reflects the tag mutation instantly.
const STATUS_QUERIES: Record<string, string> = {
	pending: 'fulfillment_status:unfulfilled status:open',
	confirmed: 'fulfillment_status:unfulfilled status:open',
	fulfilled: 'fulfillment_status:shipped',
	attempted: 'fulfillment_status:shipped',
	failed: 'fulfillment_status:shipped',
	cancelled: 'status:cancelled',
	returned: 'financial_status:refunded',
	all: ''
};

// Builds Shopify search clauses that match a Pakistani mobile number regardless of
// how it was typed (leading 0, country code 92, +92, with/without dashes or spaces).
function phoneQueryVariants(raw: string): string[] {
	const digits = raw.replace(/\D/g, '');
	if (digits.length < 5) return [`phone:${raw}*`];

	let national = digits; // number without leading 0 or country code, e.g. 3001234567
	if (digits.startsWith('0')) national = digits.slice(1);
	else if (digits.startsWith('92')) national = digits.slice(2);

	const variants = new Set([digits, national, `0${national}`, `92${national}`, `+92${national}`]);
	// Shopify search only supports a trailing wildcard, not a leading one.
	return [...variants].map((v) => `phone:${v}*`);
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

// No search syntax exists for fulfillment displayStatus (courier-pushed field), so
// count client-side over shipped orders — same reasoning as the attempted/failed
// filter below, kept light by only requesting the displayStatus field.
async function getAttemptedCount(client: ReturnType<typeof getShopifyClient>): Promise<number> {
	const gql = `
		query AttemptedCount($query: String) {
			orders(first: 250, query: $query) {
				nodes { fulfillments(first: 5) { displayStatus } }
			}
		}
	`;
	const data = await shopifyRequest<{ orders: { nodes: { fulfillments: { displayStatus: string | null }[] }[] } }>(
		client, gql, { query: STATUS_QUERIES.attempted }
	);
	return data.orders.nodes.filter((o) => orderDisplayStatus(o) === 'ATTEMPTED_DELIVERY').length;
}

// Splits by the live `tags` field (getTagSplitCounts), not a `tag:` search clause —
// the search index lags a few seconds behind a tagsAdd mutation, which made these
// badges show stale numbers right after a bulk-confirm.
async function getBadgeCounts(client: ReturnType<typeof getShopifyClient>) {
	const [{ withTag, withoutTag }, attemptedCount] = await Promise.all([
		getTagSplitCounts(client, STATUS_QUERIES.pending, CONFIRMED_TAG),
		getAttemptedCount(client)
	]);
	return { pendingCount: withoutTag, confirmedCount: withTag, attemptedCount };
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
		// customer_name isn't a valid draft-order search field — the bare/default
		// term is what matches customer name (same as Shopify admin's search box).
		const query = searchQ ? `name:${searchQ}* OR ${searchQ}*` : undefined;
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

	const isTagFiltered = status === 'pending' || status === 'confirmed' || status === 'attempted' || status === 'failed';

	let shopifyQuery = STATUS_QUERIES[status] ?? '';
	if (searchQ) {
		const phoneClauses = phoneQueryVariants(searchQ).join(' OR ');
		// customer_name isn't a valid order search field (confirmed against Shopify's
		// orders query field list) — the bare/default term matches customer name
		// instead, the same way Shopify admin's own order search box does.
		const searchPart = `(name:${searchQ}* OR ${searchQ}* OR ${phoneClauses} OR tag:${searchQ}*)`;
		shopifyQuery = shopifyQuery ? `${shopifyQuery} AND ${searchPart}` : searchPart;
	}

	// Fetch extra when tag-filtering client-side, since some fetched orders get
	// dropped by the tag split below (pagination becomes approximate as a result).
	// attempted/failed fetch as many as the badge count scans (getAttemptedCount
	// below), otherwise the visible list and its own badge count disagree.
	const isDisplayStatusFiltered = status === 'attempted' || status === 'failed';
	const [result, badgeCounts, couriers] = await Promise.all([
		listOrders(client, { first: isDisplayStatusFiltered ? 250 : isTagFiltered ? 60 : 30, after: cursor, query: shopifyQuery || undefined }),
		getBadgeCounts(client),
		getStoreCouriers(params.storeId)
	]);

	let orders = result.nodes;
	if (status === 'pending') orders = orders.filter((o) => !o.tags.includes(CONFIRMED_TAG));
	else if (status === 'confirmed') orders = orders.filter((o) => o.tags.includes(CONFIRMED_TAG));

	// "Attempted"/"Failed" filter on Shopify's fulfillment displayStatus (no search
	// syntax exists for it, so filter client-side after fetching shipped orders).
	if (status === 'attempted') {
		orders = orders.filter((o) => orderDisplayStatus(o) === 'ATTEMPTED_DELIVERY');
	} else if (status === 'failed') {
		const failed = new Set(['FAILURE', 'NOT_DELIVERED']);
		orders = orders.filter((o) => failed.has(orderDisplayStatus(o) ?? ''));
	}

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
	},

	mergeOrders: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const mainOrderId = fd.get('mainOrderId') as string;
		// Defensive dedupe — never cancel the order we just merged everything into,
		// even if the client somehow posted it in both fields.
		const otherOrderIds = [...new Set((fd.get('otherOrderIds') as string).split(',').filter(Boolean))]
			.filter((id) => id !== mainOrderId);

		if (!mainOrderId || otherOrderIds.length === 0) {
			return fail(400, { error: 'Select a main order and at least one other order to merge' });
		}

		// Step 1: move every item into the main order. If anything here throws,
		// nothing is cancelled — the merge simply didn't happen.
		let othersDetail: Awaited<ReturnType<typeof getOrder>>[];
		try {
			othersDetail = await Promise.all(otherOrderIds.map((id) => getOrder(client, toShopifyOrderId(id))));

			const { calcOrderId } = await orderEditBegin(client, toShopifyOrderId(mainOrderId));
			for (const other of othersDetail) {
				for (const item of other.lineItems.nodes) {
					if (item.currentQuantity <= 0) continue; // already removed on that order
					if (item.variant?.id) {
						await orderEditAddVariant(client, calcOrderId, item.variant.id, item.currentQuantity);
					} else {
						await orderEditAddCustomItem(
							client,
							calcOrderId,
							item.title,
							item.originalUnitPriceSet.shopMoney.amount,
							item.originalUnitPriceSet.shopMoney.currencyCode,
							item.currentQuantity
						);
					}
				}
			}
			await orderEditCommit(
				client,
				calcOrderId,
				false,
				`Merged from ${othersDetail.map((o) => o.name).join(', ')}`
			);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? `Merge failed, nothing was cancelled: ${e.message}` : 'Failed to merge orders' });
		}

		// Step 2: only now that the merge is confirmed committed, cancel the other
		// orders — one at a time, so a single failure doesn't stop the rest. If some
		// fail to cancel, the merge itself already succeeded and can't be rolled
		// back, so we report exactly which ones still need manual cancellation
		// instead of silently leaving them active (which would risk double-fulfillment).
		// restock: true — orderEditAddVariant already committed fresh inventory for
		// these items against the main order, independently of the commitment this
		// order's own creation made. Restocking here releases that original
		// commitment so the merged quantity is only deducted once, not twice.
		const cancelResults = await Promise.allSettled(
			otherOrderIds.map((id) => cancelOrder(client, toShopifyOrderId(id), 'OTHER', false, true, false))
		);
		const failedCancels = cancelResults
			.map((r, i) => ({ result: r, order: othersDetail[i] }))
			.filter((r) => r.result.status === 'rejected');

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.merge', {
				targetType: 'order', targetId: mainOrderId,
				storeId: params.storeId,
				metadata: {
					mergedFrom: otherOrderIds,
					cancelFailures: failedCancels.map((f) => f.order.name)
				}
			});
		}

		if (failedCancels.length > 0) {
			const names = failedCancels.map((f) => f.order.name).join(', ');
			return fail(400, {
				error: `Items merged into ${mainOrderId.split('/').pop()}, but failed to cancel: ${names}. Cancel ${failedCancels.length === 1 ? 'it' : 'them'} manually to avoid double-fulfilling.`
			});
		}

		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${mainOrderId.split('/').pop()}`);
	}
};
