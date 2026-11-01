export interface ActivityType {
	action: string;
	label: string;
	/** View/read events default OFF (opt-in, high volume). Mutations default ON. */
	isView: boolean;
}

export const ACTIVITY_TYPES: ActivityType[] = [
	// Viewing (opt-in, off by default)
	{ action: 'orders.list.view', label: 'Viewing the orders list', isView: true },
	{ action: 'order.view', label: 'Viewing an order', isView: true },
	{ action: 'draftOrder.view', label: 'Viewing a draft order', isView: true },
	{ action: 'customers.list.view', label: 'Viewing the customers list', isView: true },
	{ action: 'customer.view', label: 'Viewing a customer', isView: true },

	// Mutations (on by default)
	{ action: 'order.confirm', label: 'Confirming an order', isView: false },
	{ action: 'order.unconfirm', label: 'Unconfirming an order', isView: false },
	{ action: 'order.between', label: 'Moving an order to Between (with reason)', isView: false },
	{ action: 'order.backToPending', label: 'Moving an order back to pending', isView: false },
	{ action: 'order.bulkConfirm', label: 'Bulk-confirming orders', isView: false },
	{ action: 'order.merge', label: 'Merging orders (others cancelled)', isView: false },
	{ action: 'order.updateShipping', label: 'Editing shipping address', isView: false },
	{ action: 'pricing.settings.update', label: 'Updating pricing rate settings', isView: false },
	{ action: 'pricing.changes.apply', label: 'Applying pricing changes to Shopify', isView: false },
	{ action: 'pricing.reviewMarks.resetAll', label: 'Resetting all pricing review ticks', isView: false },
	{ action: 'inventory.count.apply', label: 'Applying inventory count to Shopify', isView: false },
	{ action: 'weights.apply', label: 'Saving product weights to Shopify', isView: false },
	{ action: 'dispatcher.totpReset', label: "Resetting a dispatcher's two-factor authentication", isView: false },
];

export function defaultEnabled(action: string): boolean {
	return !ACTIVITY_TYPES.find((t) => t.action === action)?.isView;
}
