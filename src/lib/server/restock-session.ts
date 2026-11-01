import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { restockSessions, stores } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import type { SessionData } from './session';

// Every restock load, action and endpoint goes through here: form actions and
// +server routes don't run the store layout's access check, so each one must
// confirm the dispatcher can see this store and that the session belongs to it.
export async function getRestockSession(session: SessionData | null, storeId: string, sessionId: string) {
	const store = await getAuthorizedStore(session, storeId);
	const [[restockSession], [lead]] = await Promise.all([
		db
			.select()
			.from(restockSessions)
			.where(and(eq(restockSessions.id, sessionId), eq(restockSessions.storeId, storeId))),
		db.select({ airDays: stores.airLeadDays, seaDays: stores.seaLeadDays }).from(stores).where(eq(stores.id, storeId))
	]);
	if (!restockSession) error(404, 'Session not found');
	return { store, restockSession, lead };
}
