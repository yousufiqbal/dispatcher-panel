import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { auditLog, dispatchers } from '$lib/server/db/schema';
import { desc, eq, and, type SQL } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const role = url.searchParams.get('role') ?? '';
	const actorId = url.searchParams.get('actorId') ?? '';

	const conditions: SQL[] = [];
	if (role === 'admin' || role === 'dispatcher') conditions.push(eq(auditLog.actorRole, role));
	if (actorId) conditions.push(eq(auditLog.actorId, actorId));

	const logs = await db
		.select()
		.from(auditLog)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(auditLog.createdAt))
		.limit(100);

	const allDispatchers = await db.select({ id: dispatchers.id, name: dispatchers.name }).from(dispatchers);

	return { logs, role, actorId, dispatchers: allDispatchers };
};
