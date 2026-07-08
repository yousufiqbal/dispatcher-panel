import type { Handle } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { loadSession, SESSION_COOKIE } from '$lib/server/session';
import { isDbConnectionError } from '$lib/server/db-errors';

const DB_DOWN_MESSAGE = 'Cannot reach the database right now. Check your internet connection and try again.';

export const handle: Handle = async ({ event, resolve }) => {
	try {
		const sessionId = event.cookies.get(SESSION_COOKIE);

		if (sessionId) {
			const session = await loadSession(sessionId);
			event.locals.session = session;
		} else {
			event.locals.session = null;
		}

		return await resolve(event);
	} catch (err) {
		if (!isDbConnectionError(err)) throw err;

		console.error('DB connection error:', err);

		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: DB_DOWN_MESSAGE }, { status: 503 });
		}
		error(503, DB_DOWN_MESSAGE);
	}
};
