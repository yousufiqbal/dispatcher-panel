import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';
import type { LiveStock } from '$lib/restock-calc';

export interface RestockVariant {
	id: number;
	productId: number;
	title: string;
	sku: string;
	imageUrl: string | null;
}

export interface RestockProduct {
	id: number;
	title: string;
	imageUrl: string | null;
	variants: RestockVariant[];
}

function gidToId(gid: string): number {
	return parseInt(gid.split('/').pop() ?? '0', 10);
}

const PRODUCTS_QUERY = `
	query FetchProducts($cursor: String, $query: String) {
		products(first: 100, after: $cursor, query: $query) {
			pageInfo { hasNextPage endCursor }
			edges {
				node {
					id
					title
					featuredImage { url }
					variants(first: 100) {
						edges {
							node {
								id
								title
								sku
								image { url }
							}
						}
					}
				}
			}
		}
	}
`;

interface ProductsQueryVariantNode {
	id: string;
	title: string;
	sku: string | null;
	image: { url: string } | null;
}

interface ProductsQueryResponse {
	products: {
		pageInfo: { hasNextPage: boolean; endCursor: string };
		edges: {
			node: {
				id: string;
				title: string;
				featuredImage: { url: string } | null;
				variants: { edges: { node: ProductsQueryVariantNode }[] };
			};
		}[];
	};
}

// Active catalog with variants — paginated 100 at a time (Shopify's practical
// cap for a query this nested without hitting cost limits). `filter` is extra
// product search syntax ANDed onto status:active, e.g. "collection_id:123".
export async function fetchRestockProducts(client: ShopifyClient, filter?: string): Promise<RestockProduct[]> {
	const query = filter ? `status:active AND ${filter}` : 'status:active';
	const products: RestockProduct[] = [];
	let cursor: string | null = null;

	while (true) {
		const result: ProductsQueryResponse = await shopifyRequest<ProductsQueryResponse>(client, PRODUCTS_QUERY, { cursor, query });

		for (const { node } of result.products.edges) {
			const productId = gidToId(node.id);
			const productImageUrl = node.featuredImage?.url ?? null;
			products.push({
				id: productId,
				title: node.title,
				imageUrl: productImageUrl,
				variants: node.variants.edges.map(({ node: v }: { node: ProductsQueryVariantNode }) => ({
					id: gidToId(v.id),
					productId,
					title: v.title,
					sku: v.sku ?? '',
					imageUrl: v.image?.url ?? productImageUrl
				}))
			});
		}

		if (!result.products.pageInfo.hasNextPage) break;
		cursor = result.products.pageInfo.endCursor;
	}

	return products;
}

const SALES_QUERY = `
	query FetchSalesOrders($cursor: String, $query: String) {
		orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT) {
			pageInfo { hasNextPage endCursor }
			edges {
				node {
					createdAt
					cancelledAt
					lineItems(first: 50) {
						edges { node { quantity variant { id } } }
					}
				}
			}
		}
	}
`;

interface SalesQueryResponse {
	orders: {
		pageInfo: { hasNextPage: boolean; endCursor: string };
		edges: { node: { createdAt: string; cancelledAt: string | null; lineItems: { edges: { node: { quantity: number; variant: { id: string } | null } }[] } } }[];
	};
}

// 30/60/90-day sold quantity per variant, used to size restock recommendations.
export async function fetchVariantSales(client: ShopifyClient, variantIds: number[]): Promise<Map<number, { s30: number; s60: number; s90: number }>> {
	const now = Date.now();
	const d30 = new Date(now - 30 * 86400000);
	const d60 = new Date(now - 60 * 86400000);
	const d90 = new Date(now - 90 * 86400000);

	const map = new Map<number, { s30: number; s60: number; s90: number }>();
	for (const id of variantIds) map.set(id, { s30: 0, s60: 0, s90: 0 });

	const query = `created_at:>='${d90.toISOString().slice(0, 10)}' AND status:any`;
	let cursor: string | null = null;

	while (true) {
		const result: SalesQueryResponse = await shopifyRequest<SalesQueryResponse>(client, SALES_QUERY, { cursor, query });

		for (const { node: order } of result.orders.edges) {
			if (order.cancelledAt) continue;
			const orderDate = new Date(order.createdAt);
			for (const { node: item } of order.lineItems.edges) {
				if (!item.variant) continue;
				const varId = gidToId(item.variant.id);
				const entry = map.get(varId);
				if (!entry) continue;
				entry.s90 += item.quantity;
				if (orderDate >= d60) entry.s60 += item.quantity;
				if (orderDate >= d30) entry.s30 += item.quantity;
			}
		}

		if (!result.orders.pageInfo.hasNextPage) break;
		cursor = result.orders.pageInfo.endCursor;
	}

	return map;
}

const MONTHLY_SALES_QUERY = `
	query FetchMonthlySales($cursor: String, $query: String) {
		orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT) {
			pageInfo { hasNextPage endCursor }
			edges {
				node {
					cancelledAt
					subtotalPriceSet { shopMoney { amount } }
					lineItems(first: 50) {
						edges { node { quantity variant { id } } }
					}
				}
			}
		}
	}
`;

interface MonthlySalesQueryResponse {
	orders: {
		pageInfo: { hasNextPage: boolean; endCursor: string };
		edges: {
			node: {
				cancelledAt: string | null;
				subtotalPriceSet: { shopMoney: { amount: string } };
				lineItems: { edges: { node: { quantity: number; variant: { id: string } | null } }[] };
			};
		}[];
	};
}

export interface MonthlySalesResult {
	netSales: number;
	unitsSold: number;
	qtyByVariant: Map<string, number>;
}

// Pulled on demand for a month-to-date sales figure — not tracked live.
// Excludes cancelled orders; refunds/returns aren't netted out here (kept
// simple), so a month with heavy returns will overstate sales slightly.
export async function fetchMonthlySales(client: ShopifyClient, start: Date, end: Date): Promise<MonthlySalesResult> {
	const query = `created_at:>='${start.toISOString().slice(0, 10)}' AND created_at:<'${end.toISOString().slice(0, 10)}' AND status:any`;
	let cursor: string | null = null;

	let netSales = 0;
	let unitsSold = 0;
	const qtyByVariant = new Map<string, number>();

	while (true) {
		const result: MonthlySalesQueryResponse = await shopifyRequest<MonthlySalesQueryResponse>(client, MONTHLY_SALES_QUERY, { cursor, query });

		for (const { node: order } of result.orders.edges) {
			if (order.cancelledAt) continue;
			netSales += parseFloat(order.subtotalPriceSet.shopMoney.amount);
			for (const { node: item } of order.lineItems.edges) {
				if (!item.variant) continue;
				unitsSold += item.quantity;
				qtyByVariant.set(item.variant.id, (qtyByVariant.get(item.variant.id) ?? 0) + item.quantity);
			}
		}

		if (!result.orders.pageInfo.hasNextPage) break;
		cursor = result.orders.pageInfo.endCursor;
	}

	return { netSales, unitsSold, qtyByVariant };
}

function qty(quantities: { name: string; quantity: number }[] | undefined, name: string): number {
	return quantities?.find((q) => q.name === name)?.quantity ?? 0;
}

const LIVE_STOCK_QUERY = `
	query LiveStock($ids: [ID!]!) {
		nodes(ids: $ids) {
			... on ProductVariant {
				id
				inventoryItem {
					inventoryLevels(first: 10) {
						edges { node { quantities(names: ["on_hand", "available", "committed", "incoming"]) { name quantity } } }
					}
				}
			}
		}
	}
`;

interface LiveStockResponse {
	nodes: ({
		id: string;
		inventoryItem: { inventoryLevels: { edges: { node: { quantities: { name: string; quantity: number }[] } }[] } } | null;
	} | null)[];
}

// Live available / committed / incoming per variant, summed across locations,
// keyed by bare numeric variant id. `incoming` is what Shopify purchase orders
// and transfers have on the way. Restock reads this fresh on every view rather
// than trusting the session-start snapshot, which goes stale as orders come in.
// Deleted variants are absent from the result.
export async function fetchLiveStock(client: ShopifyClient, variantIds: string[]): Promise<Map<string, LiveStock>> {
	const chunks: string[][] = [];
	for (let i = 0; i < variantIds.length; i += 250) {
		chunks.push(variantIds.slice(i, i + 250).map((id) => (id.startsWith('gid://') ? id : `gid://shopify/ProductVariant/${id}`)));
	}

	const out = new Map<string, LiveStock>();
	const results = await Promise.all(chunks.map((ids) => shopifyRequest<LiveStockResponse>(client, LIVE_STOCK_QUERY, { ids })));
	for (const result of results) {
		for (const node of result.nodes) {
			if (!node?.id) continue;
			const stock: LiveStock = { onHand: 0, available: 0, committed: 0, incoming: 0 };
			for (const { node: level } of node.inventoryItem?.inventoryLevels.edges ?? []) {
				stock.onHand += qty(level.quantities, 'on_hand');
				stock.available += qty(level.quantities, 'available');
				stock.committed += qty(level.quantities, 'committed');
				stock.incoming += qty(level.quantities, 'incoming');
			}
			out.set(String(gidToId(node.id)), stock);
		}
	}
	return out;
}

// --- Accounting: variant lookup for Purchases/Damages ---------------------

export interface VariantSearchResult {
	variantId: string;
	productId: string;
	productTitle: string;
	variantTitle: string | null;
	sku: string;
	imageUrl: string | null;
}

const VARIANT_SEARCH_QUERY = `
	query SearchVariants($query: String!, $first: Int!) {
		productVariants(first: $first, query: $query) {
			edges {
				node {
					id
					title
					sku
					image { url }
					product { id title featuredImage { url } }
				}
			}
		}
	}
`;

interface VariantSearchResponse {
	productVariants: {
		edges: {
			node: {
				id: string;
				title: string;
				sku: string | null;
				image: { url: string } | null;
				product: { id: string; title: string; featuredImage: { url: string } | null };
			};
		}[];
	};
}

// Free-text search across SKU and product/variant title, for "find a variant"
// pickers. Deliberately doesn't
// read inventory here — that needs the read_inventory scope, which not every
// store's token has, and on-hand qty isn't needed until getVariantForMutation
// right before the actual stock change.
export async function searchVariants(client: ShopifyClient, q: string, limit = 10): Promise<VariantSearchResult[]> {
	const escaped = q.replace(/["\\]/g, '');
	// "title" isn't a real filter field here (that's a Product-level field name);
	// variant search uses sku / product_title / variant_title instead.
	const query = `(sku:*${escaped}*) OR (product_title:*${escaped}*) OR (variant_title:*${escaped}*)`;
	const result = await shopifyRequest<VariantSearchResponse>(client, VARIANT_SEARCH_QUERY, { query, first: limit });

	return result.productVariants.edges.map(({ node: v }) => ({
		variantId: v.id,
		productId: v.product.id,
		productTitle: v.product.title,
		variantTitle: v.title === 'Default Title' ? null : v.title,
		sku: v.sku ?? '',
		imageUrl: v.image?.url ?? v.product.featuredImage?.url ?? null
	}));
}

export interface VariantForMutation {
	inventoryItemId: string;
	locationId: string;
	locationName: string | null;
	currentOnHand: number;
}

const VARIANT_FOR_MUTATION_QUERY = `
	query VariantForMutation($id: ID!) {
		node(id: $id) {
			... on ProductVariant {
				inventoryItem {
					id
					inventoryLevels(first: 1) {
						edges { node { location { id name } quantities(names: ["on_hand"]) { name quantity } } }
					}
				}
			}
		}
	}
`;

interface VariantForMutationResponse {
	node: {
		inventoryItem: {
			id: string;
			inventoryLevels: {
				edges: { node: { location: { id: string; name: string }; quantities: { name: string; quantity: number }[] } }[];
			};
		} | null;
	} | null;
}

// Re-resolves a variant's inventory item + location fresh at submit time
// (rather than trusting IDs captured client-side at search time) so a stale
// picker selection can't silently target the wrong location.
export async function getVariantForMutation(client: ShopifyClient, variantId: string): Promise<VariantForMutation | null> {
	const result = await shopifyRequest<VariantForMutationResponse>(client, VARIANT_FOR_MUTATION_QUERY, { id: variantId });
	const item = result.node?.inventoryItem;
	const level = item?.inventoryLevels?.edges?.[0]?.node;
	if (!item || !level) return null;

	return {
		inventoryItemId: item.id,
		locationId: level.location.id,
		locationName: level.location.name,
		currentOnHand: qty(level.quantities, 'on_hand')
	};
}

// Batch form of getVariantForMutation: resolves up to 250 variants in one
// round trip. Variants that no longer exist (or have no stocked location) are
// simply absent from the returned map.
const VARIANTS_FOR_MUTATION_QUERY = `
	query VariantsForMutation($ids: [ID!]!) {
		nodes(ids: $ids) {
			... on ProductVariant {
				id
				inventoryItem {
					id
					inventoryLevels(first: 1) {
						edges { node { location { id name } quantities(names: ["on_hand"]) { name quantity } } }
					}
				}
			}
		}
	}
`;

interface VariantsForMutationResponse {
	nodes: ((VariantForMutationResponse['node'] & { id: string }) | null)[];
}

export async function getVariantsForMutation(
	client: ShopifyClient,
	variantIds: string[]
): Promise<Map<string, VariantForMutation>> {
	const out = new Map<string, VariantForMutation>();
	for (let i = 0; i < variantIds.length; i += 250) {
		const chunk = variantIds.slice(i, i + 250);
		const result = await shopifyRequest<VariantsForMutationResponse>(client, VARIANTS_FOR_MUTATION_QUERY, { ids: chunk });
		for (const node of result.nodes) {
			const item = node?.inventoryItem;
			const level = item?.inventoryLevels?.edges?.[0]?.node;
			if (!node || !item || !level) continue;
			out.set(node.id, {
				inventoryItemId: item.id,
				locationId: level.location.id,
				locationName: level.location.name,
				currentOnHand: qty(level.quantities, 'on_hand')
			});
		}
	}
	return out;
}

const INVENTORY_ADJUST_MUTATION = `
	mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
		inventoryAdjustQuantities(input: $input) {
			userErrors { field message }
			inventoryAdjustmentGroup {
				createdAt
				reason
				changes { name delta quantityAfterChange }
			}
		}
	}
`;

interface InventoryAdjustResponse {
	inventoryAdjustQuantities: {
		userErrors: { field: string[] | null; message: string }[];
		inventoryAdjustmentGroup: {
			createdAt: string;
			reason: string;
			changes: { name: string; delta: number; quantityAfterChange: number }[];
		} | null;
	};
}

export interface InventoryAdjustResult {
	success: boolean;
	actualDelta: number | null;
	raw: unknown;
}

// Applies a physical on_hand change at the given location — used for both
// Purchases (+delta, reason "restock") and Damages (-delta, reason
// "damaged"). Returns the raw Shopify response alongside a pass/fail verdict
// so callers can log both into the cost-event ledger for reconciliation,
// regardless of outcome.
export type InventoryAdjustReason = 'restock' | 'damaged' | 'cycle_count_available' | 'correction';

export async function adjustInventoryQuantity(
	client: ShopifyClient,
	params: { inventoryItemId: string; locationId: string; delta: number; reason: InventoryAdjustReason }
): Promise<InventoryAdjustResult> {
	try {
		const result = await shopifyRequest<InventoryAdjustResponse>(client, INVENTORY_ADJUST_MUTATION, {
			input: {
				name: 'on_hand',
				reason: params.reason,
				changes: [
					{
						inventoryItemId: params.inventoryItemId,
						locationId: params.locationId,
						delta: params.delta,
						changeFromQuantity: null
					}
				]
			}
		});

		if (result.inventoryAdjustQuantities.userErrors.length > 0) {
			return { success: false, actualDelta: null, raw: result.inventoryAdjustQuantities.userErrors };
		}

		const change = result.inventoryAdjustQuantities.inventoryAdjustmentGroup?.changes.find((c) => c.name === 'on_hand');
		return { success: true, actualDelta: change?.delta ?? null, raw: result.inventoryAdjustQuantities };
	} catch (e) {
		return { success: false, actualDelta: null, raw: e instanceof Error ? e.message : String(e) };
	}
}

// Multi-change form: one mutation for many variants. Shopify applies the
// whole group atomically — any userError means nothing in the batch moved —
// so callers should batch conservatively and record failure for every change
// in a rejected group.
export async function adjustInventoryQuantities(
	client: ShopifyClient,
	params: {
		reason: InventoryAdjustReason;
		changes: { inventoryItemId: string; locationId: string; delta: number }[];
		// Shows up in Shopify's inventory history as the source of the change.
		referenceDocumentUri?: string;
	}
): Promise<{ success: boolean; error: string | null }> {
	if (params.changes.length === 0) return { success: true, error: null };
	try {
		// inventoryAdjustQuantities can't target on_hand directly (needs a
		// ledger document). Adjusting `available` by Δ moves on_hand by the
		// same Δ — on_hand = available + committed + unavailable — so the
		// physical stock ends up where the count says.
		const result = await shopifyRequest<InventoryAdjustResponse>(client, INVENTORY_ADJUST_MUTATION, {
			input: {
				name: 'available',
				reason: params.reason,
				referenceDocumentUri: params.referenceDocumentUri,
				changes: params.changes
			}
		});
		const errs = result.inventoryAdjustQuantities.userErrors;
		if (errs.length > 0) return { success: false, error: errs.map((e) => e.message).join('; ') };
		return { success: true, error: null };
	} catch (e) {
		return { success: false, error: e instanceof Error ? e.message : String(e) };
	}
}
