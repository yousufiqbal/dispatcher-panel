import { db } from '$lib/server/db';
import { dispatchers } from '$lib/server/db/schema';
import { eq, ne, and } from 'drizzle-orm';

// Login is by email, so two accounts can't share one. `excludeId` skips the
// account being edited.
export async function isEmailTaken(email: string, excludeId?: string): Promise<boolean> {
	const match = await db.query.dispatchers.findFirst({
		where: excludeId ? and(eq(dispatchers.email, email), ne(dispatchers.id, excludeId)) : eq(dispatchers.email, email)
	});
	return !!match;
}
