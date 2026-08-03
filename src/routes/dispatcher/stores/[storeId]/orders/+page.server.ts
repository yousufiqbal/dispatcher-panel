import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { listOrders, getTagSplitCounts, getExcludingTagsCount, confirmOrder, cancelOrder, getOrder, updateOrderShipping, updateOrderTags, CONFIRMED_TAG, INCORRECT_ADDRESS_TAG, markAddressIncorrect, unmarkAddressIncorrect, phoneQueryVariants } from '$lib/server/shopify/orders';
import { orderEditBegin, orderEditAddVariant, orderEditAddCustomItem, orderEditCommit } from '$lib/server/shopify/order-edit';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';
import { checkAddress } from '$lib/server/address-check';

const ON_HOLD_TAG = 'on-hold';
const NOT_REACHABLE_TAG = 'not-reachable';

// User-controlled date bound — the single biggest lever on how much a tab's
// full-scan (see fetchAllOrders/getTagSplitCounts/getAttemptedCount) costs.
// 'all' means no clause at all (matches pre-filter behavior exactly).
function dateFilterClause(days: string | null): string {
	const n = days ? parseInt(days, 10) : NaN;
	if (!n || n <= 0) return '';
	const cutoff = new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
	return `created_at:>=${cutoff}`;
}

function mergeQuery(...parts: (string | undefined)[]): string {
	return parts.filter(Boolean).join(' AND ');
}

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

// Pending/Confirmed/Incorrect Address/On Hold/Attempted/Failed are all
// client-filtered (tag or displayStatus, neither is a reliable search clause —
// see comments below), so unlike a real Shopify search these tabs can't page
// normally: a fixed-size page filtered client-side risks showing a partial,
// order-dependent slice. Fetching every matching order up front instead — no
// "Load more", the tab always shows its complete set in one go.
async function fetchAllOrders(client: ReturnType<typeof getShopifyClient>, query: string | undefined) {
	const all: Awaited<ReturnType<typeof listOrders>>['nodes'] = [];
	let after: string | undefined;
	while (true) {
		const page = await listOrders(client, { first: 250, after, query });
		all.push(...page.nodes);
		if (!page.pageInfo.hasNextPage) break;
		after = page.pageInfo.endCursor;
	}
	return all;
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
	'incorrect-address': 'fulfillment_status:unfulfilled status:open',
	'on-hold': 'fulfillment_status:unfulfilled status:open',
	'not-reachable': 'fulfillment_status:unfulfilled status:open',
	fulfilled: 'fulfillment_status:shipped',
	attempted: 'fulfillment_status:shipped',
	cancelled: 'status:cancelled',
	all: ''
};


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
// filter below, kept light by only requesting the displayStatus field. Paginates
// through every shipped order rather than capping at one page — this query has
// no sortKey, so Shopify's default ordering isn't guaranteed chronological, and
// a store with 250+ shipped orders could otherwise miss one arbitrarily
// (same class of bug the on-hold/incorrect-address badge counts had).
async function getAttemptedCount(client: ReturnType<typeof getShopifyClient>, dateClause: string): Promise<number> {
	const gql = `
		query AttemptedCount($query: String, $after: String) {
			orders(first: 250, after: $after, query: $query) {
				nodes { cancelledAt fulfillments(first: 5) { displayStatus } }
				pageInfo { hasNextPage endCursor }
			}
		}
	`;
	let count = 0;
	let after: string | undefined;
	const query = mergeQuery(STATUS_QUERIES.attempted, dateClause);
	while (true) {
		const data = await shopifyRequest<{
			orders: { nodes: { cancelledAt: string | null; fulfillments: { displayStatus: string | null }[] }[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
		}>(client, gql, { query, after });
		count += data.orders.nodes.filter((o) => orderDisplayStatus(o) === 'ATTEMPTED_DELIVERY' && !o.cancelledAt).length;
		if (!data.orders.pageInfo.hasNextPage) break;
		after = data.orders.pageInfo.endCursor;
	}
	return count;
}

// Splits by the live `tags` field (getTagSplitCounts), not a `tag:` search clause —
// the search index lags a few seconds behind a tagsAdd mutation, which made these
// badges show stale numbers right after a bulk-confirm.
async function getBadgeCounts(client: ReturnType<typeof getShopifyClient>, dateClause: string) {
	const [pendingCount, { withTag: confirmedCount }, attemptedCount, incorrectAddressSplit, onHoldSplit, notReachableSplit] = await Promise.all([
		getExcludingTagsCount(client, mergeQuery(STATUS_QUERIES.pending, dateClause), [CONFIRMED_TAG, INCORRECT_ADDRESS_TAG, ON_HOLD_TAG, NOT_REACHABLE_TAG]),
		getTagSplitCounts(client, mergeQuery(STATUS_QUERIES.pending, dateClause), CONFIRMED_TAG),
		getAttemptedCount(client, dateClause),
		getTagSplitCounts(client, mergeQuery(STATUS_QUERIES['incorrect-address'], dateClause), INCORRECT_ADDRESS_TAG),
		getTagSplitCounts(client, mergeQuery(STATUS_QUERIES['on-hold'], dateClause), ON_HOLD_TAG),
		getTagSplitCounts(client, mergeQuery(STATUS_QUERIES['not-reachable'], dateClause), NOT_REACHABLE_TAG)
	]);
	return {
		pendingCount,
		confirmedCount,
		attemptedCount,
		incorrectAddressCount: incorrectAddressSplit.withTag,
		onHoldCount: onHoldSplit.withTag,
		notReachableCount: notReachableSplit.withTag
	};
}

export const load: PageServerLoad = async ({ parent, url, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	const searchQ = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? 'pending';
	const cursor = url.searchParams.get('after') ?? undefined;
	const days = url.searchParams.get('days') ?? '30';
	const dateClause = dateFilterClause(days);

	if (locals.session) {
		await logAudit(locals.session.userId, 'dispatcher', 'orders.list.view', { storeId: params.storeId, metadata: { status } });
	}

	if (status === 'drafts') {
		// customer_name isn't a valid draft-order search field — the bare/default
		// term is what matches customer name (same as Shopify admin's search box).
		const searchPart = searchQ ? `name:${searchQ}* OR ${searchQ}*` : undefined;
		const query = mergeQuery(searchPart, dateClause) || undefined;
		const [result, badgeCounts, couriers] = await Promise.all([
			listDraftOrders(client, { first: 30, after: cursor, query }),
			getBadgeCounts(client, dateClause),
			getStoreCouriers(params.storeId)
		]);
		return {
			orders: [],
			drafts: result.nodes,
			pageInfo: result.pageInfo,
			searchQ,
			status,
			days,
			...badgeCounts,
			couriers
		};
	}

	const isTagFiltered = status === 'pending' || status === 'confirmed' || status === 'incorrect-address' || status === 'on-hold' || status === 'not-reachable' || status === 'attempted';

	let shopifyQuery = STATUS_QUERIES[status] ?? '';
	if (searchQ) {
		const phoneClauses = phoneQueryVariants(searchQ).join(' OR ');
		// customer_name isn't a valid order search field (confirmed against Shopify's
		// orders query field list) — the bare/default term matches customer name
		// instead, the same way Shopify admin's own order search box does.
		const searchPart = `(name:${searchQ}* OR ${searchQ}* OR ${phoneClauses} OR tag:${searchQ}*)`;
		shopifyQuery = shopifyQuery ? `${shopifyQuery} AND ${searchPart}` : searchPart;
	}
	shopifyQuery = mergeQuery(shopifyQuery, dateClause);

	const isDisplayStatusFiltered = status === 'attempted';
	// These tabs filter client-side (tag or displayStatus, neither a reliable
	// search clause), so they fetch every matching order up front instead of
	// paging — see fetchAllOrders' comment. Everything else keeps normal
	// cursor pagination.
	const fetchesEverything = isTagFiltered || isDisplayStatusFiltered;

	async function loadOrdersPage() {
		if (fetchesEverything) {
			return {
				nodes: await fetchAllOrders(client, shopifyQuery || undefined),
				pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: '', endCursor: '' }
			};
		}
		return listOrders(client, { first: 30, after: cursor, query: shopifyQuery || undefined });
	}

	const [{ nodes: rawOrders, pageInfo }, badgeCounts, couriers] = await Promise.all([
		loadOrdersPage(),
		getBadgeCounts(client, dateClause),
		getStoreCouriers(params.storeId)
	]);

	let orders = rawOrders;
	if (status === 'pending') {
		orders = orders.filter(
			(o) => !o.tags.includes(CONFIRMED_TAG) && !o.tags.includes(INCORRECT_ADDRESS_TAG) && !o.tags.includes(ON_HOLD_TAG) && !o.tags.includes(NOT_REACHABLE_TAG)
		);
	} else if (status === 'confirmed') orders = orders.filter((o) => o.tags.includes(CONFIRMED_TAG));
	else if (status === 'incorrect-address') orders = orders.filter((o) => o.tags.includes(INCORRECT_ADDRESS_TAG));
	else if (status === 'on-hold') orders = orders.filter((o) => o.tags.includes(ON_HOLD_TAG));
	else if (status === 'not-reachable') orders = orders.filter((o) => o.tags.includes(NOT_REACHABLE_TAG));

	// "Attempted" filters on Shopify's fulfillment displayStatus (no search
	// syntax exists for it, so filter client-side after fetching shipped orders).
	if (status === 'attempted') {
		orders = orders.filter((o) => orderDisplayStatus(o) === 'ATTEMPTED_DELIVERY' && !o.cancelledAt);
	}

	return {
		orders,
		drafts: [],
		pageInfo,
		searchQ,
		status,
		days,
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
	},

	bulkUpdateAddresses: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const orderIds = (fd.get('orderIds') as string).split(',').filter(Boolean);

		if (orderIds.length === 0) {
			return fail(400, { error: 'No orders selected' });
		}

		const results = await Promise.allSettled(
			orderIds.map(async (id) => {
				const shopifyId = toShopifyOrderId(id);
				await updateOrderShipping(client, shopifyId, {
					firstName: (fd.get(`firstName_${id}`) as string) ?? '',
					lastName: (fd.get(`lastName_${id}`) as string) ?? '',
					address1: (fd.get(`address1_${id}`) as string) ?? '',
					city: (fd.get(`city_${id}`) as string) ?? '',
					province: (fd.get(`province_${id}`) as string) ?? '',
					country: (fd.get(`country_${id}`) as string) ?? '',
					zip: (fd.get(`zip_${id}`) as string) ?? '',
					phone: (fd.get(`phone_${id}`) as string) || undefined
				});
				const incorrect = fd.get(`incorrectAddress_${id}`) != null;
				if (incorrect) await markAddressIncorrect(client, shopifyId);
				else await unmarkAddressIncorrect(client, shopifyId);
			})
		);

		const failed = orderIds.filter((_, i) => results[i].status === 'rejected');

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.bulkUpdateAddresses', {
				targetType: 'order', storeId: params.storeId,
				metadata: { orderIds, failed }
			});
		}

		if (failed.length > 0) {
			return fail(400, {
				error: `Updated ${orderIds.length - failed.length} of ${orderIds.length} orders. ${failed.length} failed — try again for those.`
			});
		}

		const returnStatus = (fd.get('returnStatus') as string) || 'pending';
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=${returnStatus}`);
	},

	updateOrderTagsSingle: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const orderId = fd.get('orderId') as string;
		const tagsRaw = (fd.get('tags') as string) ?? '';
		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

		if (!orderId) return fail(400, { error: 'No order specified' });

		try {
			await updateOrderTags(client, toShopifyOrderId(orderId), tags);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.updateTags', {
					targetType: 'order', targetId: orderId, storeId: params.storeId
				});
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update tags' });
		}

		const returnStatus = (fd.get('returnStatus') as string) || 'pending';
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=${returnStatus}`);
	},

	// Client computes each order's final tag list (its existing tags, plus/minus
	// what was added/removed in the modal) and submits it as tags_<id> — same
	// per-id field-naming pattern as bulkUpdateAddresses, so the server here
	// doesn't need to re-fetch or recompute anything, just apply each list.
	bulkUpdateTags: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const orderIds = (fd.get('orderIds') as string).split(',').filter(Boolean);

		if (orderIds.length === 0) return fail(400, { error: 'No orders selected' });

		const results = await Promise.allSettled(
			orderIds.map(async (id) => {
				const tagsRaw = (fd.get(`tags_${id}`) as string) ?? '';
				const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
				await updateOrderTags(client, toShopifyOrderId(id), tags);
			})
		);

		const failed = orderIds.filter((_, i) => results[i].status === 'rejected');

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.bulkUpdateTags', {
				targetType: 'order', storeId: params.storeId,
				metadata: { orderIds, failed }
			});
		}

		if (failed.length > 0) {
			return fail(400, {
				error: `Updated tags on ${orderIds.length - failed.length} of ${orderIds.length} orders. ${failed.length} failed — try again for those.`
			});
		}

		const returnStatus = (fd.get('returnStatus') as string) || 'pending';
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=${returnStatus}`);
	},

	// Dry run only — scans pending orders and reports which ones look wrong, but
	// tags nothing. The dispatcher confirms which flagged orders actually get
	// marked incorrect via markIncorrectSelected below.
	checkAddresses: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		// Same query the Pending tab uses, then the same live-tag filter — orders
		// still open, unfulfilled, and not yet marked Confirmed.
		const result = await listOrders(client, { first: 250, query: STATUS_QUERIES.pending });
		const pendingOnly = result.nodes.filter((o) => !o.tags.includes(CONFIRMED_TAG));

		const candidates = pendingOnly
			.filter((o) => !o.tags.includes(INCORRECT_ADDRESS_TAG))
			.map((o) => ({ id: o.id, name: o.name, customerName: o.customer?.displayName ?? o.shippingAddress?.name ?? 'Guest', reasons: checkAddress(o) }))
			.filter((c) => c.reasons.length > 0);

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.checkAddresses', {
				targetType: 'order', storeId: params.storeId,
				metadata: { checked: pendingOnly.length, flagged: candidates.length }
			});
		}

		return { checked: pendingOnly.length, candidates };
	},

	markIncorrectSelected: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const ids = (fd.get('ids') as string ?? '').split(',').filter(Boolean);

		if (ids.length === 0) {
			throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=pending`);
		}

		const results = await Promise.allSettled(ids.map((id) => markAddressIncorrect(client, toShopifyOrderId(id))));
		const tagged = results.filter((r) => r.status === 'fulfilled').length;

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.markIncorrectSelected', {
				targetType: 'order', storeId: params.storeId,
				metadata: { ids, tagged }
			});
		}

		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=pending&autoChecked=${tagged}`);
	}
};
