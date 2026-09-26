import { shopifyRequest } from './client';
import { toActiveLineItems, toCurrentTotals } from './orders';
import type { ShopifyClient } from './client';

export interface CustomerNode {
	id: string;
	displayName: string;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	phone: string | null;
	numberOfOrders: number;
	defaultAddress: {
		address1: string | null;
		address2: string | null;
		city: string | null;
		province: string | null;
		country: string | null;
		zip: string | null;
		phone: string | null;
	} | null;
}

export async function listCustomers(
	client: ShopifyClient,
	opts: { first?: number; after?: string; query?: string }
): Promise<{ nodes: CustomerNode[]; pageInfo: { hasNextPage: boolean; endCursor: string } }> {
	const gql = `
    query ListCustomers($first: Int!, $after: String, $query: String) {
      customers(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id displayName firstName lastName email phone numberOfOrders
          defaultAddress { address1 address2 city province country zip phone }
        }
      }
    }
  `;
	const data = await shopifyRequest<{
		customers: {
			nodes: CustomerNode[];
			pageInfo: { hasNextPage: boolean; endCursor: string };
		};
	}>(client, gql, { first: opts.first ?? 50, after: opts.after, query: opts.query });
	return data.customers;
}

// Two gotchas here, both silent (no error, just fewer results):
// 1. Customer.orders (the connection) can under-report vs. the admin UI, so we
//    use a top-level `orders` search instead, filtered on customer_id.
// 2. Shopify's order search defaults to `status:open` when the query string
//    doesn't mention status at all — closed/archived orders (e.g. old
//    fulfilled-and-closed ones) silently vanish unless `status:any` is added.
export interface CustomerOrderNode {
	id: string;
	name: string;
	createdAt: string;
	cancelledAt: string | null;
	displayFinancialStatus: string;
	displayFulfillmentStatus: string;
	totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
	currentTotalPriceSet?: { shopMoney: { amount: string; currencyCode: string } } | null;
	originalTotalPriceSet?: { shopMoney: { amount: string; currencyCode: string } };
	shippingAddress: { city: string; country: string } | null;
	lineItems: {
		nodes: {
			title: string;
			quantity: number;
			currentQuantity?: number;
			variant: { title: string; sku: string | null; image: { url: string; altText: string | null } | null } | null;
			image: { url: string; altText: string | null } | null;
		}[];
	};
	fulfillments: { displayStatus: string | null; trackingInfo: { company: string | null; number: string | null; url: string | null }[] }[];
}

export async function getCustomer(
	client: ShopifyClient,
	customerId: string
): Promise<CustomerNode & { orders: { nodes: CustomerOrderNode[] } }> {
	const numericId = customerId.split('/').pop();
	const gql = `
    query GetCustomer($id: ID!, $ordersQuery: String) {
      customer(id: $id) {
        id displayName firstName lastName email phone numberOfOrders
        defaultAddress { address1 city province country zip }
      }
      orders(first: 20, sortKey: CREATED_AT, reverse: true, query: $ordersQuery) {
        nodes {
          id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          shippingAddress { city country }
          lineItems(first: 50) {
            nodes {
              title quantity currentQuantity
              variant { title sku image { url altText } }
              image { url altText }
            }
          }
          fulfillments(first: 5) { displayStatus trackingInfo { company number url } }
        }
      }
    }
  `;
	const data = await shopifyRequest<{
		customer: CustomerNode | null;
		orders: { nodes: CustomerOrderNode[] };
	}>(client, gql, { id: customerId, ordersQuery: `customer_id:"${numericId}" status:any` });

	if (!data.customer) throw new Error('Customer not found');
	for (const o of data.orders.nodes) {
		o.lineItems.nodes = toActiveLineItems(o.lineItems.nodes);
		toCurrentTotals(o);
	}
	return { ...data.customer, orders: data.orders };
}

export async function createCustomer(
	client: ShopifyClient,
	input: {
		firstName: string;
		lastName: string;
		email?: string;
		phone?: string;
		addresses?: { address1: string; city: string; province: string; country: string; zip: string }[];
	}
): Promise<string> {
	const gql = `
    mutation CustomerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		customerCreate: { customer: { id: string } | null; userErrors: { field: string[]; message: string }[] };
	}>(client, gql, { input });

	if (data.customerCreate.userErrors.length > 0) {
		throw new Error(data.customerCreate.userErrors.map((e) => e.message).join(', '));
	}
	return data.customerCreate.customer!.id;
}

export async function updateCustomer(
	client: ShopifyClient,
	input: {
		id: string;
		firstName?: string;
		lastName?: string;
		email?: string;
		phone?: string;
		addresses?: { address1: string; city: string; province: string; country: string; zip: string }[];
	}
): Promise<void> {
	const gql = `
    mutation CustomerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }
  `;
	const data = await shopifyRequest<{
		customerUpdate: { userErrors: { field: string[]; message: string }[] };
	}>(client, gql, { input });

	if (data.customerUpdate.userErrors.length > 0) {
		throw new Error(data.customerUpdate.userErrors.map((e) => e.message).join(', '));
	}
}
