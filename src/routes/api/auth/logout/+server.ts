import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession, clearSessionCookie } from '$lib/server/session';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.session) {
		await deleteSession(locals.session.id);
	}
	clearSessionCookie(cookies);
	return json({ ok: true });
};
