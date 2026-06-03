import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';

export async function orderEditBegin(
	client: ShopifyClient,
	orderId: string
): Promise<{ calcOrderId: string; lineItems: { id: string; quantity: number }[] }> {
	const gql = `
    mutation orderEditBegin($id: ID!) {
      orderEditBegin(id: $id) {
        calculatedOrder {
          id
          lineItems(first: 50) {
            nodes { id quantity }
          }
        }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditBegin: {
			calculatedOrder: { id: string; lineItems: { nodes: { id: string; quantity: number }[] } };
			userErrors: { field: string[]; message: string }[];
		} | null;
	}>(client, gql, { id: orderId });
	if (!data.orderEditBegin) throw new Error('Order cannot be edited — it may be fulfilled or cancelled');
	if (data.orderEditBegin.userErrors.length) throw new Error(data.orderEditBegin.userErrors.map(e => e.message).join(', '));
	return {
		calcOrderId: data.orderEditBegin.calculatedOrder.id,
		lineItems: data.orderEditBegin.calculatedOrder.lineItems.nodes
	};
}

export async function orderEditSetQuantity(client: ShopifyClient, calcOrderId: string, lineItemId: string, quantity: number): Promise<void> {
	const gql = `
    mutation orderEditSetQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!) {
      orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditSetQuantity: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, lineItemId, quantity });
	if (!data.orderEditSetQuantity) throw new Error('orderEditSetQuantity returned null');
	if (data.orderEditSetQuantity.userErrors.length) throw new Error(data.orderEditSetQuantity.userErrors.map(e => e.message).join(', '));
}

export async function orderEditAddVariant(client: ShopifyClient, calcOrderId: string, variantId: string, quantity: number): Promise<void> {
	const gql = `
    mutation orderEditAddVariant($id: ID!, $variantId: ID!, $quantity: Int!) {
      orderEditAddVariant(id: $id, variantId: $variantId, quantity: $quantity) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditAddVariant: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, variantId, quantity });
	if (!data.orderEditAddVariant) throw new Error('orderEditAddVariant returned null');
	if (data.orderEditAddVariant.userErrors.length) throw new Error(data.orderEditAddVariant.userErrors.map(e => e.message).join(', '));
}

export async function orderEditAddDiscount(
	client: ShopifyClient,
	calcOrderId: string,
	lineItemId: string,
	discount: { value: number; valueType: 'PERCENTAGE' | 'FIXED_AMOUNT'; description: string }
): Promise<void> {
	const gql = `
    mutation orderEditAddLineItemDiscount($id: ID!, $lineItemId: ID!, $discount: OrderEditAppliedDiscountInput!) {
      orderEditAddLineItemDiscount(id: $id, lineItemId: $lineItemId, discount: $discount) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditAddLineItemDiscount: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, lineItemId, discount });
	if (!data.orderEditAddLineItemDiscount) throw new Error('orderEditAddLineItemDiscount returned null');
	if (data.orderEditAddLineItemDiscount.userErrors.length) throw new Error(data.orderEditAddLineItemDiscount.userErrors.map(e => e.message).join(', '));
}

export async function orderEditCommit(client: ShopifyClient, calcOrderId: string, notifyCustomer: boolean, staffNote: string): Promise<void> {
	const gql = `
    mutation orderEditCommit($id: ID!, $notifyCustomer: Boolean!, $staffNote: String) {
      orderEditCommit(id: $id, notifyCustomer: $notifyCustomer, staffNote: $staffNote) {
        order { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditCommit: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, notifyCustomer, staffNote });
	if (!data.orderEditCommit) throw new Error('orderEditCommit returned null');
	if (data.orderEditCommit.userErrors.length) throw new Error(data.orderEditCommit.userErrors.map(e => e.message).join(', '));
}
