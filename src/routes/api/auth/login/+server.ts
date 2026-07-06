import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { admin, dispatchers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verify } from 'argon2';
import { createSession, setSessionCookie } from '$lib/server/session';
import { parse, safeParse } from 'valibot';
import { LoginSchema } from '$lib/schemas/auth';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const body = await request.json().catch(() => null);
	const result = safeParse(LoginSchema, body);
	if (!result.success) {
		return json({ error: 'Invalid input' }, { status: 400 });
	}

	const { email, password } = result.output;
	const ip = getClientAddress();
	const ua = request.headers.get('user-agent') ?? undefined;

	// Check admin first
	const adminUser = await db.query.admin.findFirst({ where: eq(admin.email, email) });
	if (adminUser) {
		const valid = await verify(adminUser.passwordHash, password).catch(() => false);
		if (!valid) return json({ error: 'Invalid credentials' }, { status: 401 });

		// TOTP temporarily disabled — sessions are pre-verified
		const sessionId = await createSession(adminUser.id, 'admin', true, ip, ua);
		setSessionCookie(cookies, sessionId, new Date(Date.now() + 2 * 60 * 60 * 1000));

		return json({ role: 'admin', redirect: '/admin' });
	}

	// Check dispatcher
	const dispatcher = await db.query.dispatchers.findFirst({
		where: eq(dispatchers.email, email)
	});
	if (dispatcher) {
		if (!dispatcher.isActive) {
			return json({ error: 'Account is disabled' }, { status: 403 });
		}
		const valid = await verify(dispatcher.passwordHash, password).catch(() => false);
		if (!valid) return json({ error: 'Invalid credentials' }, { status: 401 });

		const sessionId = await createSession(dispatcher.id, 'dispatcher', true, ip, ua);
		setSessionCookie(cookies, sessionId, new Date(Date.now() + 8 * 60 * 60 * 1000));

		return json({ role: 'dispatcher', redirect: '/dashboard' });
	}

	return json({ error: 'Invalid credentials' }, { status: 401 });
};
