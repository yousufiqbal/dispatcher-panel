import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';

export interface DraftOrderLineItem {
	variantId?: string;
	title?: string;
	price?: string;
	quantity: number;
}

export interface DraftOrderInput {
	lineItems: DraftOrderLineItem[];
	customerId?: string;
	shippingAddress?: {
		firstName: string;
		lastName: string;
		address1: string;
		address2?: string;
		city: string;
		province: string;
		country: string;
		zip: string;
		phone?: string;
	};
	shippingLine?: {
		title: string;
		price: string;
	};
	appliedDiscount?: {
		value: number;
		valueType: 'PERCENTAGE' | 'FIXED_AMOUNT';
		title: string;
	};
	note?: string;
}

export async function createDraftOrder(
	client: ShopifyClient,
	input: DraftOrderInput
): Promise<{ id: string; name: string; invoiceUrl: string | null }> {
	const gql = `
    mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id name invoiceUrl }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		draftOrderCreate: {
			draftOrder: { id: string; name: string; invoiceUrl: string | null };
			userErrors: { field: string[]; message: string }[];
		};
	}>(client, gql, { input });

	if (data.draftOrderCreate.userErrors.length > 0) {
		throw new Error(data.draftOrderCreate.userErrors.map((e) => e.message).join(', '));
	}
	return data.draftOrderCreate.draftOrder;
}

export async function completeDraftOrder(
	client: ShopifyClient,
	draftOrderId: string
): Promise<{ orderId: string; orderName: string }> {
	const gql = `
    mutation DraftOrderComplete($id: ID!) {
      draftOrderComplete(id: $id) {
        draftOrder { order { id name } }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		draftOrderComplete: {
			draftOrder: { order: { id: string; name: string } };
			userErrors: { field: string[]; message: string }[];
		};
	}>(client, gql, { id: draftOrderId });

	if (data.draftOrderComplete.userErrors.length > 0) {
		throw new Error(data.draftOrderComplete.userErrors.map((e) => e.message).join(', '));
	}
	return {
		orderId: data.draftOrderComplete.draftOrder.order.id,
		orderName: data.draftOrderComplete.draftOrder.order.name
	};
}

export async function searchProducts(
	client: ShopifyClient,
	query: string
): Promise<{ id: string; title: string; featuredImage?: { url: string } | null; variants: { nodes: { id: string; title: string; price: string; sku: string | null; inventoryQuantity: number | null }[] } }[]> {
	const gql = `
    query SearchProducts($query: String!) {
      products(first: 10, query: $query) {
        nodes {
          id title
          featuredImage { url }
          variants(first: 10) {
            nodes { id title price sku inventoryQuantity }
          }
        }
      }
    }
  `;
	const data = await shopifyRequest<{
		products: {
			nodes: {
				id: string;
				title: string;
				variants: {
					nodes: { id: string; title: string; price: string; sku: string | null; inventoryQuantity: number | null }[];
				};
			}[];
		};
	}>(client, gql, { query });
	return data.products.nodes;
}
