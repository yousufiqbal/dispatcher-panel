import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';

export interface ProductVariantNode {
	id: string;
	title: string;
	sku: string | null;
	price: string;
	inventoryQuantity: number | null;
	image: { url: string; altText: string | null } | null;
	selectedOptions: { name: string; value: string }[];
}

export interface ProductNode {
	id: string;
	title: string;
	status: string;
	featuredImage: { url: string; altText: string | null } | null;
	totalInventory: number;
	variants: { nodes: { id: string }[] };
}

export interface ProductDetail {
	id: string;
	title: string;
	descriptionHtml: string;
	status: string;
	totalInventory: number;
	images: { nodes: { url: string; altText: string | null }[] };
	variants: { nodes: ProductVariantNode[] };
}

export interface PageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string;
	endCursor: string;
}

export async function listProducts(
	client: ShopifyClient,
	opts: { first?: number; after?: string; query?: string } = {}
): Promise<{ nodes: ProductNode[]; pageInfo: PageInfo }> {
	const gql = `
		query ListProducts($first: Int!, $after: String, $query: String) {
			products(first: $first, after: $after, query: $query, sortKey: TITLE) {
				nodes {
					id title status
					featuredImage { url altText }
					totalInventory
					variants(first: 1) { nodes { id } }
				}
				pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
			}
		}
	`;
	const data = await shopifyRequest<{ products: { nodes: ProductNode[]; pageInfo: PageInfo } }>(
		client,
		gql,
		{ first: opts.first ?? 30, after: opts.after, query: opts.query }
	);
	return data.products;
}

export async function getProductsCount(
	client: ShopifyClient,
	opts: { query?: string } = {}
): Promise<number> {
	const gql = `
		query ProductsCount($query: String) {
			productsCount(query: $query) { count }
		}
	`;
	const data = await shopifyRequest<{ productsCount: { count: number } }>(client, gql, { query: opts.query });
	return data.productsCount.count;
}

export async function getProduct(
	client: ShopifyClient,
	id: string
): Promise<{ product: ProductDetail; currencyCode: string }> {
	const gql = `
		query GetProduct($id: ID!) {
			shop { currencyCode }
			product(id: $id) {
				id title descriptionHtml status totalInventory
				images(first: 20) { nodes { url altText } }
				variants(first: 100) {
					nodes {
						id title sku price inventoryQuantity
						image { url altText }
						selectedOptions { name value }
					}
				}
			}
		}
	`;
	const data = await shopifyRequest<{ product: ProductDetail; shop: { currencyCode: string } }>(client, gql, { id });
	return { product: data.product, currencyCode: data.shop.currencyCode };
}

export async function listProductsWithInventory(
	client: ShopifyClient,
	opts: { first?: number; after?: string; query?: string } = {}
): Promise<{
	nodes: {
		id: string;
		title: string;
		featuredImage: { url: string; altText: string | null } | null;
		totalInventory: number;
		variants: { nodes: ProductVariantNode[] };
	}[];
	pageInfo: PageInfo;
}> {
	const gql = `
		query ListProductsInventory($first: Int!, $after: String, $query: String) {
			products(first: $first, after: $after, query: $query, sortKey: TITLE) {
				nodes {
					id title
					featuredImage { url altText }
					totalInventory
					variants(first: 100) {
						nodes {
							id title sku price inventoryQuantity
							image { url altText }
							selectedOptions { name value }
						}
					}
				}
				pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
			}
		}
	`;
	return (
		await shopifyRequest<{
			products: {
				nodes: {
					id: string;
					title: string;
					featuredImage: { url: string; altText: string | null } | null;
					totalInventory: number;
					variants: { nodes: ProductVariantNode[] };
				}[];
				pageInfo: PageInfo;
			};
		}>(client, gql, { first: opts.first ?? 20, after: opts.after, query: opts.query })
	).products;
}
