import { shopifyRequest } from './client';
import type { ShopifyClient } from './client';

export interface OrderNode {
	id: string;
	name: string;
	createdAt: string;
	displayFinancialStatus: string;
	displayFulfillmentStatus: string;
	totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
	phone: string | null;
	customer: { id: string; displayName: string; phone: string | null; email: string | null } | null;
	lineItems: { nodes: { quantity: number }[] };
	shippingAddress: {
		name: string;
		address1: string;
		city: string;
		province: string;
		country: string;
		zip: string;
		phone: string | null;
	} | null;
	tags: string[];
}

export interface PageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string;
	endCursor: string;
}

const ORDER_FIELDS = `
  id name createdAt displayFinancialStatus displayFulfillmentStatus
  totalPriceSet { shopMoney { amount currencyCode } }
  phone
  customer { id displayName phone email }
  shippingAddress { name address1 city province country zip phone }
  lineItems(first: 50) { nodes { quantity } }
  tags
`;

export async function listOrders(
	client: ShopifyClient,
	opts: { first?: number; after?: string; before?: string; query?: string }
): Promise<{ nodes: OrderNode[]; pageInfo: PageInfo }> {
	const gql = `
    query ListOrders($first: Int, $after: String, $before: String, $query: String) {
      orders(first: $first, after: $after, before: $before, query: $query, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
        nodes { ${ORDER_FIELDS} }
      }
    }
  `;
	const data = await shopifyRequest<{ orders: { nodes: OrderNode[]; pageInfo: PageInfo } }>(
		client,
		gql,
		{ first: opts.first ?? 50, after: opts.after, before: opts.before, query: opts.query }
	);
	return data.orders;
}

export interface OrderDetail extends OrderNode {
	lineItems: {
		nodes: {
			id: string;
			title: string;
			quantity: number;
			originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
			variant: { id: string; title: string; sku: string | null; image: { url: string; altText: string | null } | null } | null;
			image: { url: string; altText: string | null } | null;
		}[];
	};
	discountCodes: string[];
	shippingLines: {
		nodes: { id: string; title: string; originalPriceSet: { shopMoney: { amount: string } } }[];
	};
	fulfillments: {
		id: string;
		status: string;
		trackingInfo: { number: string; url: string | null }[];
		fulfillmentLineItems: {
			nodes: { id: string; quantity: number; lineItem: { title: string } }[];
		};
	}[];
	subtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
	totalShippingPriceSet: { shopMoney: { amount: string; currencyCode: string } };
	totalReceivedSet: { shopMoney: { amount: string; currencyCode: string } };
	refunds: { id: string; createdAt: string; totalRefundedSet: { shopMoney: { amount: string } } }[];
	note: string | null;
}

export async function getOrder(client: ShopifyClient, orderId: string): Promise<OrderDetail> {
	const gql = `
    query GetOrder($id: ID!) {
      order(id: $id) {
        ${ORDER_FIELDS}
        note
        lineItems(first: 50) {
          nodes {
            id title quantity
            originalUnitPriceSet { shopMoney { amount currencyCode } }
            variant { id title sku image { url altText } }
            image { url altText }
          }
        }
        discountCodes
        shippingLines(first: 10) {
          nodes { id title originalPriceSet { shopMoney { amount } } }
        }
        fulfillments(first: 10) {
          id status
          trackingInfo { number url }
          fulfillmentLineItems(first: 50) {
            nodes { id quantity lineItem { title } }
          }
        }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        totalShippingPriceSet { shopMoney { amount currencyCode } }
        totalReceivedSet { shopMoney { amount currencyCode } }
        refunds(first: 10) {
          id createdAt totalRefundedSet { shopMoney { amount } }
        }
      }
    }
  `;
	const data = await shopifyRequest<{ order: OrderDetail }>(client, gql, { id: orderId });
	return data.order;
}

export async function cancelOrder(
	client: ShopifyClient,
	orderId: string,
	reason: string,
	refund: boolean
): Promise<void> {
	const gql = `
    mutation CancelOrder($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $notify: Boolean!) {
      orderCancel(orderId: $orderId, reason: $reason, refund: $refund, notifyCustomer: $notify) {
        orderCancelUserErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderCancel: { orderCancelUserErrors: { field: string[]; message: string }[] };
	}>(client, gql, { orderId, reason, refund, notify: false });

	if (data.orderCancel.orderCancelUserErrors.length > 0) {
		throw new Error(data.orderCancel.orderCancelUserErrors.map((e) => e.message).join(', '));
	}
}

export const CONFIRMED_TAG = 'Confirmed';

export async function confirmOrder(client: ShopifyClient, orderId: string): Promise<void> {
	const gql = `
    mutation TagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		tagsAdd: { userErrors: { field: string[]; message: string }[] };
	}>(client, gql, { id: orderId, tags: [CONFIRMED_TAG] });

	if (data.tagsAdd.userErrors.length > 0) {
		throw new Error(data.tagsAdd.userErrors.map((e) => e.message).join(', '));
	}
}

export async function unconfirmOrder(client: ShopifyClient, orderId: string): Promise<void> {
	const gql = `
    mutation TagsRemove($id: ID!, $tags: [String!]!) {
      tagsRemove(id: $id, tags: $tags) {
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		tagsRemove: { userErrors: { field: string[]; message: string }[] };
	}>(client, gql, { id: orderId, tags: [CONFIRMED_TAG] });

	if (data.tagsRemove.userErrors.length > 0) {
		throw new Error(data.tagsRemove.userErrors.map((e) => e.message).join(', '));
	}
}

export async function fulfillOrder(
	client: ShopifyClient,
	orderId: string,
	trackingNumber: string | null,
	trackingCompany: string | null
): Promise<string> {
	// First get the fulfillment order ID
	const foGql = `
    query GetFulfillmentOrders($orderId: ID!) {
      order(id: $orderId) {
        fulfillmentOrders(first: 10) {
          nodes { id status }
        }
      }
    }
  `;
	const foData = await shopifyRequest<{
		order: { fulfillmentOrders: { nodes: { id: string; status: string }[] } };
	}>(client, foGql, { orderId });

	const pendingFo = foData.order.fulfillmentOrders.nodes.find(
		(fo) => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS'
	);
	if (!pendingFo) throw new Error('No open fulfillment order found');

	const gql = `
    mutation FulfillmentCreate($fulfillment: FulfillmentV2Input!) {
      fulfillmentCreateV2(fulfillment: $fulfillment) {
        fulfillment { id status }
        userErrors { field message }
      }
    }
  `;
	const fulfillment: Record<string, unknown> = {
		lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: pendingFo.id }],
		notifyCustomer: false
	};
	if (trackingNumber) {
		fulfillment.trackingInfo = {
			number: trackingNumber,
			company: trackingCompany ?? 'Other'
		};
	}

	const data = await shopifyRequest<{
		fulfillmentCreateV2: {
			fulfillment: { id: string; status: string };
			userErrors: { field: string[]; message: string }[];
		};
	}>(client, gql, { fulfillment });

	if (data.fulfillmentCreateV2.userErrors.length > 0) {
		throw new Error(data.fulfillmentCreateV2.userErrors.map((e) => e.message).join(', '));
	}
	return data.fulfillmentCreateV2.fulfillment.id;
}

export async function refundOrder(
	client: ShopifyClient,
	orderId: string,
	refundLineItems: { lineItemId: string; quantity: number; restockType: string }[],
	notify: boolean,
	note: string
): Promise<void> {
	const gql = `
    mutation RefundCreate($input: RefundInput!) {
      refundCreate(input: $input) {
        refund { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		refundCreate: {
			refund: { id: string } | null;
			userErrors: { field: string[]; message: string }[];
		};
	}>(client, gql, {
		input: {
			orderId,
			notify,
			note,
			refundLineItems: refundLineItems.map((r) => ({
				lineItemId: r.lineItemId,
				quantity: r.quantity,
				restockType: r.restockType
			}))
		}
	});

	if (data.refundCreate.userErrors.length > 0) {
		throw new Error(data.refundCreate.userErrors.map((e) => e.message).join(', '));
	}
}

export async function updateOrderShipping(
	client: ShopifyClient,
	orderId: string,
	address: {
		firstName: string;
		lastName: string;
		address1: string;
		address2?: string;
		city: string;
		province: string;
		country: string;
		zip: string;
		phone?: string;
	}
): Promise<void> {
	const gql = `
    mutation OrderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		orderUpdate: { userErrors: { field: string[]; message: string }[] };
	}>(client, gql, { input: { id: orderId, shippingAddress: address } });

	if (data.orderUpdate.userErrors.length > 0) {
		throw new Error(data.orderUpdate.userErrors.map((e) => e.message).join(', '));
	}
}
