import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { auditLog } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const logs = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100);
	return { logs };
};
