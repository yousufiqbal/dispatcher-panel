import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';
import { weightToGrams } from '$lib/pricing';

export interface PricingVariant {
	id: string;
	inventoryItemId: string;
	title: string;
	sku: string | null;
	price: number;
	compareAtPrice: number | null;
	weightGrams: number;
	imageUrl: string | null;
	selectedOptions: { name: string; value: string }[];
}

export interface PricingProduct {
	id: string;
	title: string;
	imageUrl: string | null;
	variants: PricingVariant[];
}

const PRICING_PRODUCTS_QUERY = `
	query FetchPricingProducts($cursor: String) {
		products(first: 50, after: $cursor, query: "status:active") {
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
								price
								compareAtPrice
								image { url }
								selectedOptions { name value }
								inventoryItem {
									id
									measurement { weight { value unit } }
								}
							}
						}
					}
				}
			}
		}
	}
`;

interface PricingQueryVariantNode {
	id: string;
	title: string;
	sku: string | null;
	price: string;
	compareAtPrice: string | null;
	image: { url: string } | null;
	selectedOptions: { name: string; value: string }[];
	inventoryItem: { id: string; measurement: { weight: { value: number; unit: string } | null } } | null;
}

interface PricingQueryResponse {
	products: {
		pageInfo: { hasNextPage: boolean; endCursor: string };
		edges: {
			node: {
				id: string;
				title: string;
				featuredImage: { url: string } | null;
				variants: { edges: { node: PricingQueryVariantNode }[] };
			};
		}[];
	};
}

export async function fetchPricingProducts(client: ShopifyClient): Promise<PricingProduct[]> {
	const products: PricingProduct[] = [];
	let cursor: string | null = null;

	while (true) {
		const result: PricingQueryResponse = await shopifyRequest<PricingQueryResponse>(
			client,
			PRICING_PRODUCTS_QUERY,
			{ cursor }
		);

		for (const { node } of result.products.edges) {
			const productImageUrl = node.featuredImage?.url ?? null;
			products.push({
				id: node.id,
				title: node.title,
				imageUrl: productImageUrl,
				variants: node.variants.edges.map(({ node: v }) => {
					const w = v.inventoryItem?.measurement?.weight;
					return {
						id: v.id,
						inventoryItemId: v.inventoryItem?.id ?? '',
						title: v.title,
						sku: v.sku,
						price: parseFloat(v.price),
						compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
						weightGrams: w ? Math.round(weightToGrams(w.value, w.unit)) : 0,
						imageUrl: v.image?.url ?? productImageUrl,
						selectedOptions: v.selectedOptions ?? []
					};
				})
			});
		}

		if (!result.products.pageInfo.hasNextPage) break;
		cursor = result.products.pageInfo.endCursor;
	}

	return products;
}

const PRODUCT_VARIANTS_BULK_UPDATE = `
	mutation PricingBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
		productVariantsBulkUpdate(productId: $productId, variants: $variants) {
			userErrors { field message }
		}
	}
`;

export interface VariantPriceUpdate {
	variantId: string;
	// Omit a field entirely (rather than passing its unchanged value) so the
	// mutation leaves it alone — sending compareAtPrice back as "0.00" when
	// there was never a compare-at set would clobber it instead of no-op'ing.
	price?: number;
	compareAtPrice?: number;
}

export async function applyProductVariantPrices(
	client: ShopifyClient,
	productId: string,
	updates: VariantPriceUpdate[]
): Promise<void> {
	const variants = updates
		.filter((u) => u.price !== undefined || u.compareAtPrice !== undefined)
		.map((u) => ({
			id: u.variantId,
			...(u.price !== undefined ? { price: u.price.toFixed(2) } : {}),
			...(u.compareAtPrice !== undefined ? { compareAtPrice: u.compareAtPrice.toFixed(2) } : {})
		}));
	if (variants.length === 0) return;

	const data = await shopifyRequest<{
		productVariantsBulkUpdate: { userErrors: { field: string[]; message: string }[] };
	}>(client, PRODUCT_VARIANTS_BULK_UPDATE, { productId, variants });
	const errors = data.productVariantsBulkUpdate.userErrors;
	if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
}

const INVENTORY_ITEM_UPDATE = `
	mutation PricingWeightUpdate($id: ID!, $input: InventoryItemUpdateInput!) {
		inventoryItemUpdate(id: $id, input: $input) {
			userErrors { field message }
		}
	}
`;

export async function applyVariantWeight(client: ShopifyClient, inventoryItemId: string, grams: number): Promise<void> {
	const data = await shopifyRequest<{
		inventoryItemUpdate: { userErrors: { field: string[]; message: string }[] };
	}>(client, INVENTORY_ITEM_UPDATE, {
		id: inventoryItemId,
		input: { measurement: { weight: { value: grams, unit: 'GRAMS' } } }
	});
	const errors = data.inventoryItemUpdate.userErrors;
	if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
}
