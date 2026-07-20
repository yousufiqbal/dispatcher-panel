import { db } from '$lib/server/db';
import { admin, dispatchers, accountants } from '$lib/server/db/schema';
import { eq, ne, and } from 'drizzle-orm';

// Each of admin/dispatchers/accountants enforces email-uniqueness only within
// its own table, so the same email can otherwise end up on two roles at once —
// login resolves admin -> dispatcher -> accounting in order, so the earlier
// match silently wins and the other account becomes unreachable. Call this
// before create/update on dispatcher or accountant accounts to block that.
export async function isEmailTakenElsewhere(
	email: string,
	excludeRole: 'dispatcher' | 'accounting',
	excludeId?: string
): Promise<boolean> {
	const dispatcherWhere =
		excludeRole === 'dispatcher'
			? excludeId
				? and(eq(dispatchers.email, email), ne(dispatchers.id, excludeId))
				: undefined
			: eq(dispatchers.email, email);

	const accountantWhere =
		excludeRole === 'accounting'
			? excludeId
				? and(eq(accountants.email, email), ne(accountants.id, excludeId))
				: undefined
			: eq(accountants.email, email);

	const [adminMatch, dispatcherMatch, accountantMatch] = await Promise.all([
		db.query.admin.findFirst({ where: eq(admin.email, email) }),
		dispatcherWhere ? db.query.dispatchers.findFirst({ where: dispatcherWhere }) : null,
		accountantWhere ? db.query.accountants.findFirst({ where: accountantWhere }) : null
	]);

	return !!(adminMatch || dispatcherMatch || accountantMatch);
}
