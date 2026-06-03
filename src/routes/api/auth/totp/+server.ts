import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeParse } from 'valibot';
import { TotpSchema } from '$lib/schemas/auth';
import { updateSessionTotp, SESSION_COOKIE } from '$lib/server/session';
import { db } from '$lib/server/db';
import { admin } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { TOTP } from 'otpauth';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	if (!session || session.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (session.totpVerified) {
		return json({ ok: true, redirect: '/admin' });
	}

	const body = await request.json().catch(() => null);
	const result = safeParse(TotpSchema, body);
	if (!result.success) {
		return json({ error: 'Invalid code format' }, { status: 400 });
	}

	const adminUser = await db.query.admin.findFirst({
		where: eq(admin.id, session.userId)
	});
	if (!adminUser?.totpSecret) {
		return json({ error: 'TOTP not configured' }, { status: 400 });
	}

	const totp = new TOTP({ secret: adminUser.totpSecret, digits: 6, period: 30 });
	const delta = totp.validate({ token: result.output.code, window: 1 });

	if (delta === null) {
		return json({ error: 'Invalid code' }, { status: 401 });
	}

	await updateSessionTotp(session.id);
	return json({ ok: true, redirect: '/admin' });
};
