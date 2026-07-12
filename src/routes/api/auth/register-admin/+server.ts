import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { admin } from '$lib/server/db/schema';
import { hash } from 'argon2';
import { safeParse } from 'valibot';
import { RegisterAdminSchema } from '$lib/schemas/auth';
import { createSession, setSessionCookie } from '$lib/server/session';

// Only allowed once — bootstraps the very first admin account when the table
// is empty. Once an admin exists, this always 403s; further admins are created
// from inside the admin panel instead (there's no open self-registration).
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const existing = await db.query.admin.findFirst();
	if (existing) {
		return json({ error: 'An admin account already exists' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const result = safeParse(RegisterAdminSchema, body);
	if (!result.success) {
		return json({ error: result.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
	}

	const { email, password } = result.output;
	const passwordHash = await hash(password);
	const [created] = await db.insert(admin).values({ email, passwordHash }).returning();

	const ip = getClientAddress();
	const ua = request.headers.get('user-agent') ?? undefined;
	const sessionId = await createSession(created.id, 'admin', true, ip, ua);
	setSessionCookie(cookies, sessionId, new Date(Date.now() + 2 * 60 * 60 * 1000));

	return json({ role: 'admin', redirect: '/admin' });
};
