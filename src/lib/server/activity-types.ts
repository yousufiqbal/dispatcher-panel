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
	{ action: 'order.bulkConfirm', label: 'Bulk-confirming orders', isView: false },
	{ action: 'order.fulfill', label: 'Fulfilling an order', isView: false },
	{ action: 'order.cancel', label: 'Cancelling an order', isView: false },
	{ action: 'order.refund', label: 'Refunding an order', isView: false },
	{ action: 'order.markAsPaid', label: 'Marking an order as paid', isView: false },
	{ action: 'order.updateShipping', label: 'Editing shipping address', isView: false },
	{ action: 'order.duplicate', label: 'Duplicating an order', isView: false },
	{ action: 'order.resendInvoice', label: 'Resending an invoice', isView: false },
	{ action: 'order.courierBook', label: 'Booking a courier shipment', isView: false }
];

export function defaultEnabled(action: string): boolean {
	return !ACTIVITY_TYPES.find((t) => t.action === action)?.isView;
}
