import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';

export interface CalculatedShippingLine {
	id: string;
	title: string;
	price: { shopMoney: { amount: string; currencyCode: string } };
}

export interface CalculatedLineItem {
	id: string;
	quantity: number;
	/** Discounts already on this line, including ones staged by earlier edits. */
	calculatedDiscountAllocations: { discountApplication: { id: string; __typename: string } }[];
}

export async function orderEditBegin(
	client: ShopifyClient,
	orderId: string
): Promise<{
	calcOrderId: string;
	lineItems: CalculatedLineItem[];
	shippingLines: CalculatedShippingLine[];
}> {
	// Shipping lines come back as CalculatedShippingLine ids — distinct from the
	// order's own ShippingLine ids, and the only ones the remove/update
	// mutations accept — so they have to be read from here, not from getOrder.
	const gql = `
    mutation orderEditBegin($id: ID!) {
      orderEditBegin(id: $id) {
        calculatedOrder {
          id
          lineItems(first: 50) {
            nodes {
              id
              quantity
              calculatedDiscountAllocations {
                discountApplication { id __typename }
              }
            }
          }
          shippingLines {
            id
            title
            price { shopMoney { amount currencyCode } }
          }
        }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditBegin: {
			calculatedOrder: {
				id: string;
				lineItems: { nodes: CalculatedLineItem[] };
				shippingLines: CalculatedShippingLine[];
			};
			userErrors: { field: string[]; message: string }[];
		} | null;
	}>(client, gql, { id: orderId });
	if (!data.orderEditBegin) throw new Error('Order cannot be edited — it may be fulfilled or cancelled');
	if (data.orderEditBegin.userErrors.length) throw new Error(data.orderEditBegin.userErrors.map(e => e.message).join(', '));
	return {
		calcOrderId: data.orderEditBegin.calculatedOrder.id,
		lineItems: data.orderEditBegin.calculatedOrder.lineItems.nodes,
		shippingLines: data.orderEditBegin.calculatedOrder.shippingLines ?? []
	};
}

export async function orderEditAddShippingLine(
	client: ShopifyClient,
	calcOrderId: string,
	shippingLine: { title: string; amount: number; currencyCode: string }
): Promise<void> {
	const gql = `
    mutation orderEditAddShippingLine($id: ID!, $shippingLine: OrderEditAddShippingLineInput!) {
      orderEditAddShippingLine(id: $id, shippingLine: $shippingLine) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditAddShippingLine: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, {
		id: calcOrderId,
		shippingLine: {
			title: shippingLine.title,
			price: { amount: String(shippingLine.amount), currencyCode: shippingLine.currencyCode }
		}
	});
	if (!data.orderEditAddShippingLine) throw new Error('orderEditAddShippingLine returned null');
	if (data.orderEditAddShippingLine.userErrors.length) throw new Error(data.orderEditAddShippingLine.userErrors.map(e => e.message).join(', '));
}

export async function orderEditRemoveShippingLine(
	client: ShopifyClient,
	calcOrderId: string,
	shippingLineId: string
): Promise<void> {
	const gql = `
    mutation orderEditRemoveShippingLine($id: ID!, $shippingLineId: ID!) {
      orderEditRemoveShippingLine(id: $id, shippingLineId: $shippingLineId) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditRemoveShippingLine: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, shippingLineId });
	if (!data.orderEditRemoveShippingLine) throw new Error('orderEditRemoveShippingLine returned null');
	if (data.orderEditRemoveShippingLine.userErrors.length) throw new Error(data.orderEditRemoveShippingLine.userErrors.map(e => e.message).join(', '));
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

export async function orderEditAddCustomItem(
	client: ShopifyClient,
	calcOrderId: string,
	title: string,
	price: string,
	currencyCode: string,
	quantity: number
): Promise<void> {
	const gql = `
    mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!, $quantity: Int!) {
      orderEditAddCustomItem(id: $id, title: $title, price: $price, quantity: $quantity) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditAddCustomItem: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, title, price: { amount: price, currencyCode }, quantity });
	if (!data.orderEditAddCustomItem) throw new Error('orderEditAddCustomItem returned null');
	if (data.orderEditAddCustomItem.userErrors.length) throw new Error(data.orderEditAddCustomItem.userErrors.map(e => e.message).join(', '));
}

export async function orderEditAddDiscount(
	client: ShopifyClient,
	calcOrderId: string,
	lineItemId: string,
	discount: { value: number; valueType: 'PERCENTAGE' | 'FIXED_AMOUNT'; description: string; currencyCode?: string }
): Promise<void> {
	// OrderEditAppliedDiscountInput doesn't take value/valueType — it's
	// percentValue (Float) or fixedValue (MoneyInput), one or the other.
	if (discount.valueType === 'FIXED_AMOUNT' && !discount.currencyCode) {
		throw new Error('currencyCode is required for a fixed-amount discount');
	}
	const discountInput = discount.valueType === 'PERCENTAGE'
		? { percentValue: discount.value, description: discount.description }
		: { fixedValue: { amount: String(discount.value), currencyCode: discount.currencyCode }, description: discount.description };

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
	}>(client, gql, { id: calcOrderId, lineItemId, discount: discountInput });
	if (!data.orderEditAddLineItemDiscount) throw new Error('orderEditAddLineItemDiscount returned null');
	if (data.orderEditAddLineItemDiscount.userErrors.length) throw new Error(data.orderEditAddLineItemDiscount.userErrors.map(e => e.message).join(', '));
}

// Manual discounts are the ones this panel (and the Shopify admin's own
// "custom discount") create. Code and automatic discounts carry different
// types and must be left alone.
export function isManualDiscountApplication(typename: string): boolean {
	return typename === 'CalculatedManualDiscountApplication';
}

export async function orderEditRemoveDiscount(
	client: ShopifyClient,
	calcOrderId: string,
	discountApplicationId: string
): Promise<void> {
	const gql = `
    mutation orderEditRemoveDiscount($id: ID!, $discountApplicationId: ID!) {
      orderEditRemoveDiscount(id: $id, discountApplicationId: $discountApplicationId) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderEditRemoveDiscount: { userErrors: { field: string[]; message: string }[] } | null;
	}>(client, gql, { id: calcOrderId, discountApplicationId });
	if (!data.orderEditRemoveDiscount) throw new Error('orderEditRemoveDiscount returned null');
	if (data.orderEditRemoveDiscount.userErrors.length) throw new Error(data.orderEditRemoveDiscount.userErrors.map(e => e.message).join(', '));
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
