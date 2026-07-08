import { shopifyRequest } from './client';
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

export async function getCustomer(
	client: ShopifyClient,
	customerId: string
): Promise<CustomerNode & { orders: { nodes: { id: string; name: string; createdAt: string; totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }; displayFinancialStatus: string }[] } }> {
	const gql = `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id displayName firstName lastName email phone numberOfOrders
        defaultAddress { address1 city province country zip }
        orders(first: 20, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id name createdAt displayFinancialStatus
            totalPriceSet { shopMoney { amount currencyCode } }
          }
        }
      }
    }
  `;
	const data = await shopifyRequest<{ customer: CustomerNode & { orders: { nodes: { id: string; name: string; createdAt: string; totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }; displayFinancialStatus: string }[] } } }>(
		client,
		gql,
		{ id: customerId }
	);
	return data.customer;
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
