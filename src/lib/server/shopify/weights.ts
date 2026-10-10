import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';
import { weightToGrams } from '$lib/pricing';
import { listProducts, type ProductNode } from './products';

export interface WeightVariant {
	id: string;
	inventoryItemId: string;
	title: string;
	sku: string | null;
	inventoryQuantity: number;
	weightGrams: number;
	// Raw unit Shopify has stored — anything other than GRAMS gets normalised
	// to grams the next time it's saved from the Weights page.
	weightUnit: string | null;
	// Variant's own photo only — the page falls back to the product image.
	imageUrl: string | null;
	thumbUrl: string | null;
	selectedOptions: { name: string; value: string }[];
}

export interface WeightProduct {
	id: string;
	title: string;
	status: string;
	imageUrl: string | null;
	collectionIds: string[];
	variants: WeightVariant[];
}

// Variants come from a flat productVariants walk rather than nested under
// products — nesting 100 variants per product blows the per-query cost cap.
const WEIGHT_VARIANTS_QUERY = `
	query FetchWeightVariants($cursor: String) {
		productVariants(first: 100, after: $cursor) {
			pageInfo { hasNextPage endCursor }
			nodes {
				id
				title
				sku
				position
				inventoryQuantity
				selectedOptions { name value }
				media(first: 1) {
					nodes {
						preview { image { url thumbUrl: url(transform: { maxWidth: 120, maxHeight: 120 }) } }
					}
				}
				product { id }
				inventoryItem {
					id
					measurement { weight { value unit } }
				}
			}
		}
	}
`;

interface WeightQueryVariantNode {
	id: string;
	title: string;
	sku: string | null;
	position: number;
	inventoryQuantity: number | null;
	selectedOptions: { name: string; value: string }[];
	media: { nodes: { preview: { image: { url: string; thumbUrl: string } | null } | null }[] };
	product: { id: string };
	inventoryItem: { id: string; measurement: { weight: { value: number; unit: string } | null } } | null;
}

interface WeightQueryResponse {
	productVariants: {
		pageInfo: { hasNextPage: boolean; endCursor: string };
		nodes: WeightQueryVariantNode[];
	};
}

async function fetchAllVariants(client: ShopifyClient): Promise<WeightQueryVariantNode[]> {
	const all: WeightQueryVariantNode[] = [];
	let cursor: string | null = null;
	while (true) {
		const result: WeightQueryResponse = await shopifyRequest<WeightQueryResponse>(client, WEIGHT_VARIANTS_QUERY, { cursor });
		all.push(...result.productVariants.nodes);
		if (!result.productVariants.pageInfo.hasNextPage) break;
		cursor = result.productVariants.pageInfo.endCursor;
	}
	return all;
}

async function fetchAllProducts(client: ShopifyClient): Promise<ProductNode[]> {
	const all: ProductNode[] = [];
	let after: string | undefined;
	while (true) {
		const page = await listProducts(client, { first: 250, after, query: '(status:active OR status:draft)' });
		all.push(...page.nodes);
		if (!page.pageInfo.hasNextPage) break;
		after = page.pageInfo.endCursor;
	}
	return all;
}

// Active + draft products (archived hidden, same as the Products page), each
// with its variants in Shopify's position order.
export async function fetchWeightProducts(client: ShopifyClient): Promise<WeightProduct[]> {
	const [products, variants] = await Promise.all([fetchAllProducts(client), fetchAllVariants(client)]);

	const byProduct = new Map<string, WeightQueryVariantNode[]>();
	for (const v of variants) {
		const list = byProduct.get(v.product.id);
		if (list) list.push(v);
		else byProduct.set(v.product.id, [v]);
	}

	return products.map((p) => ({
		id: p.id,
		title: p.title,
		status: p.status,
		imageUrl: p.featuredImage?.url ?? null,
		collectionIds: p.collections.nodes.map((c) => c.id),
		variants: (byProduct.get(p.id) ?? [])
			.sort((a, b) => a.position - b.position)
			.map((v) => {
				const w = v.inventoryItem?.measurement?.weight;
				const img = v.media.nodes[0]?.preview?.image ?? null;
				return {
					id: v.id,
					inventoryItemId: v.inventoryItem?.id ?? '',
					title: v.title,
					sku: v.sku,
					inventoryQuantity: v.inventoryQuantity ?? 0,
					weightGrams: w ? Math.round(weightToGrams(w.value, w.unit)) : 0,
					weightUnit: w?.unit ?? null,
					imageUrl: img?.url ?? null,
					thumbUrl: img?.thumbUrl ?? null,
					selectedOptions: v.selectedOptions ?? []
				};
			})
	}));
}

const LIVE_WEIGHTS_QUERY = `
	query LiveVariantWeights($ids: [ID!]!) {
		nodes(ids: $ids) {
			... on ProductVariant {
				id
				inventoryItem { measurement { weight { value unit } } }
			}
		}
	}
`;

// Fresh read right before a save — the page may have been open a while and
// someone could have changed a weight in Shopify admin meanwhile.
export async function fetchLiveWeights(client: ShopifyClient, variantIds: string[]): Promise<Map<string, number>> {
	const out = new Map<string, number>();
	for (let i = 0; i < variantIds.length; i += 250) {
		const data = await shopifyRequest<{
			nodes: ({ id: string; inventoryItem: { measurement: { weight: { value: number; unit: string } | null } } | null } | null)[];
		}>(client, LIVE_WEIGHTS_QUERY, { ids: variantIds.slice(i, i + 250) });
		for (const n of data.nodes) {
			if (!n?.id) continue;
			const w = n.inventoryItem?.measurement?.weight;
			out.set(n.id, w ? Math.round(weightToGrams(w.value, w.unit)) : 0);
		}
	}
	return out;
}

const VARIANT_WEIGHTS_BULK_UPDATE = `
	mutation WeightsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
		productVariantsBulkUpdate(productId: $productId, variants: $variants) {
			userErrors { field message }
		}
	}
`;

// One call per product for all its variants — far cheaper than an
// inventoryItemUpdate per variant. All-or-nothing per product.
export async function applyProductWeights(
	client: ShopifyClient,
	productId: string,
	updates: { variantId: string; grams: number }[]
): Promise<void> {
	if (updates.length === 0) return;
	const data = await shopifyRequest<{
		productVariantsBulkUpdate: { userErrors: { field: string[]; message: string }[] };
	}>(client, VARIANT_WEIGHTS_BULK_UPDATE, {
		productId,
		variants: updates.map((u) => ({
			id: u.variantId,
			inventoryItem: { measurement: { weight: { value: u.grams, unit: 'GRAMS' } } }
		}))
	});
	const errors = data.productVariantsBulkUpdate.userErrors;
	if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
}
