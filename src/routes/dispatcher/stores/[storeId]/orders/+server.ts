import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The old Orders list was removed; Confirmer replaced it.
// Old bookmarks and links still land somewhere sensible. Order detail pages
// under /orders/... are unaffected.
export const GET: RequestHandler = ({ url, params }) => {
	const base = `/dispatcher/stores/${params.storeId}`;
	const status = url.searchParams.get('status');
	const tab = status === 'confirmed' || status === 'between' || status === 'fulfilled' ? `?tab=${status}` : '';
	throw redirect(303, `${base}/confirmer${tab}`);
};
