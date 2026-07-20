import type { LayoutServerLoad } from './$types';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const store = await getAuthorizedAccountingStore(locals.session, params.storeId);
	return { storeName: store.name };
};
