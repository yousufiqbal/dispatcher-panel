import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';

export interface RestockVariant {
	id: number;
	productId: number;
	title: string;
	sku: string;
	inventoryQuantity: number;
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
	query FetchProducts($cursor: String) {
		products(first: 100, after: $cursor, query: "status:active") {
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
								inventoryQuantity
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
	inventoryQuantity: number | null;
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

// Full active catalog with variants + inventory — paginated 100 at a time
// (Shopify's practical cap for a query this nested without hitting cost limits).
export async function fetchRestockProducts(client: ShopifyClient): Promise<RestockProduct[]> {
	const products: RestockProduct[] = [];
	let cursor: string | null = null;

	while (true) {
		const result: ProductsQueryResponse = await shopifyRequest<ProductsQueryResponse>(client, PRODUCTS_QUERY, { cursor });

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
					inventoryQuantity: v.inventoryQuantity ?? 0,
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

// How many units to reorder so stock covers `leadDays` transit + a further
// `coverDays` of expected sales at the current 30-day daily velocity.
export function calcRecommendation(sales30: number, currentStock: number, leadDays: number, coverDays = 30): number {
	const dailyVelocity = sales30 / 30;
	return Math.max(0, Math.ceil(dailyVelocity * (leadDays + coverDays) - currentStock));
}
