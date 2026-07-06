export const SHOPIFY_SCOPES = [
	{ scope: 'read_products', why: 'Product/variant name and image on order line items, draft order product search, Products and Inventory pages' },
	{ scope: 'write_customers', why: 'Create, edit, view customers (write implies read)' },
	{ scope: 'write_draft_orders', why: 'Create and view draft orders (write implies read)' },
	{ scope: 'write_fulfillments', why: 'Fulfill orders, view fulfillment status (write implies read)' },
	{ scope: 'read_merchant_managed_fulfillment_orders', why: 'Required separately from write_fulfillments to read fulfillmentOrders — needed to fulfill/unfulfill orders' },
	{ scope: 'write_merchant_managed_fulfillment_orders', why: 'Required separately from write_fulfillments to actually create/cancel a fulfillment (fulfillmentCreate/fulfillmentCancel)' },
	{ scope: 'write_orders', why: 'View orders, cancel, refund, edit shipping (write implies read)' },
	{ scope: 'write_shipping', why: 'Edit order shipping address/lines' }
] as const;

export const SHOPIFY_SCOPE_STRING = SHOPIFY_SCOPES.map((s) => s.scope).join(',');
