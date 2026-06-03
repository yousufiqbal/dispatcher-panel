import type { Handle } from '@sveltejs/kit';
import { loadSession, SESSION_COOKIE } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(SESSION_COOKIE);

	if (sessionId) {
		const session = await loadSession(sessionId);
		event.locals.session = session;
	} else {
		event.locals.session = null;
	}

	return resolve(event);
};
