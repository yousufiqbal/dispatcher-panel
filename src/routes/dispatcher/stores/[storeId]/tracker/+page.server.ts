import type { PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listTrackerOrders } from '$lib/server/shopify/tracker';
import { DEFAULT_TRACKER_WINDOW, MAX_TRACKER_WINDOW } from '$lib/tracker';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	// Buttons offer 30/60/120, but any whole number up to a year can be typed
	// into the URL (?days=365) for the occasional deep look back. Out-of-range
	// or garbage falls back to the default; over the cap is clamped to it.
	const requested = Number(url.searchParams.get('days'));
	const days = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, MAX_TRACKER_WINDOW) : DEFAULT_TRACKER_WINDOW;

	const orders = await listTrackerOrders(client, days);
	return { orders, days };
};
