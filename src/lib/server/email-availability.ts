import { db } from '$lib/server/db';
import { admin, dispatchers } from '$lib/server/db/schema';
import { eq, ne, and } from 'drizzle-orm';

// admin and dispatchers each enforce email-uniqueness only within their own
// table, so the same email can otherwise end up on two roles at once — login
// resolves admin -> dispatcher in order, so the earlier match silently wins
// and the other account becomes unreachable. Call this before create/update
// on dispatcher accounts to block that.
export async function isEmailTakenElsewhere(
	email: string,
	excludeRole: 'dispatcher',
	excludeId?: string
): Promise<boolean> {
	const dispatcherWhere =
		excludeRole === 'dispatcher'
			? excludeId
				? and(eq(dispatchers.email, email), ne(dispatchers.id, excludeId))
				: undefined
			: eq(dispatchers.email, email);

	const [adminMatch, dispatcherMatch] = await Promise.all([
		db.query.admin.findFirst({ where: eq(admin.email, email) }),
		dispatcherWhere ? db.query.dispatchers.findFirst({ where: dispatcherWhere }) : null
	]);

	return !!(adminMatch || dispatcherMatch);
}
