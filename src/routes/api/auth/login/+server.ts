import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { admin, dispatchers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verify } from 'argon2';
import { createSession, setSessionCookie } from '$lib/server/session';
import { isDeviceTrusted } from '$lib/server/trusted-device';
import { safeParse } from 'valibot';
import { LoginSchema } from '$lib/schemas/auth';

const ADMIN_TTL_MS = 2 * 60 * 60 * 1000;
const STAFF_TTL_MS = 8 * 60 * 60 * 1000;

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
		setSessionCookie(cookies, sessionId, new Date(Date.now() + ADMIN_TTL_MS));

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

		// 2FA is mandatory here. The session is created either way so the TOTP
		// step has something to authenticate against, but it stays unverified —
		// and the dispatcher layout refuses unverified sessions — until a valid
		// code is entered (or this device is already remembered).
		const trusted = dispatcher.totpEnabled && (await isDeviceTrusted(cookies, dispatcher.id, 'dispatcher'));
		const sessionId = await createSession(dispatcher.id, 'dispatcher', trusted, ip, ua);
		setSessionCookie(cookies, sessionId, new Date(Date.now() + STAFF_TTL_MS));

		if (trusted) return json({ role: 'dispatcher', redirect: '/dispatcher' });
		return json({ role: 'dispatcher', next: dispatcher.totpEnabled ? 'totp' : 'totp-setup' });
	}

	return json({ error: 'Invalid credentials' }, { status: 401 });
};
