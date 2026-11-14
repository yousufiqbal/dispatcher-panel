import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { auditLog, dispatchers } from '$lib/server/db/schema';
import { desc, eq, asc } from 'drizzle-orm';
import { requireOwner } from '$lib/server/owner';
import { activityLabel } from '$lib/server/activity-types';

const LIMIT = 100;

export const load: PageServerLoad = async ({ url, locals }) => {
	requireOwner(locals.session);
	const actorId = url.searchParams.get('actorId') ?? '';

	const [rows, people] = await Promise.all([
		db
			.select()
			.from(auditLog)
			.where(actorId ? eq(auditLog.actorId, actorId) : undefined)
			.orderBy(desc(auditLog.createdAt))
			.limit(LIMIT),
		db.select({ id: dispatchers.id, name: dispatchers.name }).from(dispatchers).orderBy(asc(dispatchers.name))
	]);

	// Entries from the removed admin panel have no matching person.
	const nameById = new Map(people.map((p) => [p.id, p.name]));
	return {
		actorId,
		limit: LIMIT,
		people,
		logs: rows.map((r) => ({
			id: r.id,
			createdAt: r.createdAt.toISOString(),
			actorName: nameById.get(r.actorId) ?? (r.actorRole === 'admin' ? 'Admin (old panel)' : 'Unknown'),
			action: r.action,
			label: activityLabel(r.action),
			targetType: r.targetType,
			targetId: r.targetId,
			metadata: r.metadata
		}))
	};
};
