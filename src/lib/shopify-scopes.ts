export const SHOPIFY_SCOPES = [
	{ scope: 'read_products', why: 'Product/variant name and image on order line items, draft order product search' },
	{ scope: 'write_customers', why: 'Create, edit, view customers (write implies read)' },
	{ scope: 'write_draft_orders', why: 'Create and view draft orders (write implies read)' },
	{ scope: 'write_fulfillments', why: 'Fulfill orders, view fulfillment status (write implies read)' },
	{ scope: 'write_orders', why: 'View orders, cancel, refund, edit shipping (write implies read)' },
	{ scope: 'write_shipping', why: 'Edit order shipping address/lines' }
] as const;

export const SHOPIFY_SCOPE_STRING = SHOPIFY_SCOPES.map((s) => s.scope).join(',');
