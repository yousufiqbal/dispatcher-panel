import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The old Orders list was removed; Confirmer (labelled "Orders") replaced it.
// Old bookmarks and links still land somewhere sensible. Order detail,
// booking, labels, invoices and new-order pages under /orders/... are unaffected.
export const GET: RequestHandler = ({ url, params }) => {
	const base = `/dispatcher/stores/${params.storeId}`;
	const labels = url.searchParams.get('labels');
	if (labels) {
		const sp = new URLSearchParams({ labels });
		const booked = url.searchParams.get('booked');
		if (booked) sp.set('booked', booked);
		throw redirect(303, `${base}/tracker?${sp}`);
	}
	const status = url.searchParams.get('status');
	const tab = status === 'confirmed' || status === 'between' || status === 'fulfilled' ? `?tab=${status}` : '';
	throw redirect(303, `${base}/confirmer${tab}`);
};
