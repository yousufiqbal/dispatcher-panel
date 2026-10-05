/**
 * The main Orders list page (/dispatcher/stores/[storeId]/orders) is hidden
 * for now — order handling happens mostly in Shopify, with Confirmer and
 * Tracker covering the panel's side. Undecided whether it comes back: flip
 * this to `false` to restore it exactly as it was (nothing has been deleted).
 *
 * Only the *list* is hidden. Order detail pages, courier booking, labels,
 * invoices and new-order creation under /orders/... all keep working —
 * Confirmer and Tracker link into them.
 */
export const ORDERS_LIST_HIDDEN = true;

/** Where a store opens: the Orders list, or Confirmer while that's hidden. */
export function storeHome(storeId: string): string {
	return `/dispatcher/stores/${storeId}/${ORDERS_LIST_HIDDEN ? 'confirmer' : 'orders'}`;
}
