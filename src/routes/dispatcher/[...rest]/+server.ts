import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Old bookmarks: pages used to live under /dispatcher/stores/<storeId>/…
// (and owner pages under /dispatcher/…). Send them to the same page today.
export const GET: RequestHandler = ({ params, url }) => {
	const parts = params.rest.split('/').filter(Boolean);
	const rest = parts[0] === 'stores' ? parts.slice(2) : parts;
	redirect(301, `/${rest.join('/') || 'confirmer'}${url.search}`);
};
