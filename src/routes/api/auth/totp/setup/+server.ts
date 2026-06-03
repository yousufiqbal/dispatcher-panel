import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { admin } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { Secret, TOTP } from 'otpauth';
import { safeParse } from 'valibot';
import { TotpSchema } from '$lib/schemas/auth';
import { updateSessionTotp } from '$lib/server/session';
import QRCode from 'qrcode';

// GET: generate a new TOTP secret and return QR code
export const GET: RequestHandler = async ({ locals }) => {
	const session = locals.session;
	if (!session || session.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const adminUser = await db.query.admin.findFirst({ where: eq(admin.id, session.userId) });
	if (!adminUser) return json({ error: 'Not found' }, { status: 404 });

	const secret = new Secret({ size: 20 });
	const totp = new TOTP({
		issuer: 'Dispatcher Panel',
		label: adminUser.email,
		secret,
		digits: 6,
		period: 30
	});

	const otpauthUrl = totp.toString();
	const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

	// Store the pending secret temporarily on the admin row (will be confirmed on POST)
	await db.update(admin).set({ totpSecret: secret.base32 }).where(eq(admin.id, adminUser.id));

	return json({ qrDataUrl, secret: secret.base32, otpauthUrl });
};

// POST: confirm code to finalize TOTP setup
export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	if (!session || session.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const result = safeParse(TotpSchema, body);
	if (!result.success) {
		return json({ error: 'Invalid code format' }, { status: 400 });
	}

	const adminUser = await db.query.admin.findFirst({ where: eq(admin.id, session.userId) });
	if (!adminUser?.totpSecret) {
		return json({ error: 'No pending TOTP secret' }, { status: 400 });
	}

	const totp = new TOTP({ secret: adminUser.totpSecret, digits: 6, period: 30 });
	const delta = totp.validate({ token: result.output.code, window: 1 });

	if (delta === null) {
		return json({ error: 'Invalid code — try again' }, { status: 401 });
	}

	await db
		.update(admin)
		.set({ totpEnabled: true })
		.where(eq(admin.id, adminUser.id));

	await updateSessionTotp(session.id);
	return json({ ok: true, redirect: '/admin' });
};
