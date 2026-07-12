import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
	const existingAdmin = await db.query.admin.findFirst();
	return { hasAdmin: !!existingAdmin };
};
