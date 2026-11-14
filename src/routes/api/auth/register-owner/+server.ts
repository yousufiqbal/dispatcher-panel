import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dispatchers } from '$lib/server/db/schema';
import { hash } from 'argon2';
import { safeParse } from 'valibot';
import { RegisterOwnerSchema } from '$lib/schemas/auth';
import { createSession, setSessionCookie } from '$lib/server/session';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// First-run setup only: creates the owner when no account exists yet (a fresh
// deployment). Once any account exists this always 403s — further people are
// added from the owner's Team page, never by self-registration.
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const existing = await db.query.dispatchers.findFirst({ columns: { id: true } });
	if (existing) {
		return json({ error: 'This panel is already set up' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const result = safeParse(RegisterOwnerSchema, body);
	if (!result.success) {
		return json({ error: result.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
	}

	const { name, email, password } = result.output;
	const passwordHash = await hash(password);
	const [owner] = await db
		.insert(dispatchers)
		.values({ name, email, passwordHash, isOwner: true })
		.returning({ id: dispatchers.id });

	// Signed in but not verified: 2FA enrolment is mandatory before the panel opens.
	const sessionId = await createSession(owner.id, 'dispatcher', false, getClientAddress(), request.headers.get('user-agent') ?? undefined);
	setSessionCookie(cookies, sessionId, new Date(Date.now() + SESSION_TTL_MS));

	return json({ next: 'totp-setup' });
};
