// Pills for Shopify's Fulfillment.displayStatus — same source as the "Delivery
// status" column in the Shopify admin (courier pushes events to Shopify).
export const DELIVERY_PILLS: Record<string, { label: string; class: string }> = {
	DELIVERED: { label: 'Delivered', class: 'bg-zinc-100 text-zinc-700' },
	IN_TRANSIT: { label: 'In transit', class: 'bg-blue-100 text-blue-800' },
	OUT_FOR_DELIVERY: { label: 'Out for delivery', class: 'bg-blue-100 text-blue-800' },
	ATTEMPTED_DELIVERY: { label: 'Attempted delivery', class: 'bg-yellow-100 text-yellow-800' },
	FAILURE: { label: 'Failed delivery', class: 'bg-red-100 text-red-700' },
	NOT_DELIVERED: { label: 'Failed delivery', class: 'bg-red-100 text-red-700' },
	PICKED_UP: { label: 'Picked up', class: 'bg-zinc-100 text-zinc-700' },
	READY_FOR_PICKUP: { label: 'Ready for pickup', class: 'bg-zinc-100 text-zinc-700' },
	CANCELED: { label: 'Canceled', class: 'bg-zinc-100 text-zinc-700' }
};

// Statuses without a mapped pill (FULFILLED, MARKED_AS_FULFILLED, CONFIRMED,
// SUBMITTED, LABEL_*, …) mean no carrier delivery events yet — show "Tracking
// added" when a tracking number exists (matching Shopify admin), else nothing.
export function deliveryPill(
	displayStatus: string | null | undefined,
	hasTracking: boolean
): { label: string; class: string } | null {
	if (displayStatus && DELIVERY_PILLS[displayStatus]) return DELIVERY_PILLS[displayStatus];
	if (hasTracking) return { label: 'Tracking added', class: 'bg-zinc-100 text-zinc-700' };
	return null;
}
