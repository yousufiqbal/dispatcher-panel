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
	{ action: 'inventory.count.apply', label: 'Applying inventory count to Shopify', isView: false },
	{ action: 'weights.apply', label: 'Saving product weights to Shopify', isView: false },
	{ action: 'dispatcher.totpReset', label: "Resetting a dispatcher's two-factor authentication", isView: false },
	{ action: 'team.create', label: 'Adding a team member', isView: false },
	{ action: 'team.update', label: "Editing a team member's details", isView: false },
	{ action: 'team.disable', label: 'Disabling a team member', isView: false },
	{ action: 'team.enable', label: 'Re-enabling a team member', isView: false },
	{ action: 'settings.update', label: 'Changing panel settings', isView: false },
];

/** Human label for an action key, falling back to the key itself. */
export function activityLabel(action: string): string {
	return ACTIVITY_TYPES.find((t) => t.action === action)?.label ?? action;
}

export function defaultEnabled(action: string): boolean {
	return !ACTIVITY_TYPES.find((t) => t.action === action)?.isView;
}
