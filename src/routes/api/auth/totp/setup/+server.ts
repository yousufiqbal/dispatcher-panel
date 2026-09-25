import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Secret, TOTP } from 'otpauth';
import { safeParse } from 'valibot';
import { TotpSchema } from '$lib/schemas/auth';
import { updateSessionTotp } from '$lib/server/session';
import { loadTotpAccount, saveTotpSecret, enableTotp, verifyTotpCode, TOTP_ISSUER } from '$lib/server/totp';
import { trustDevice } from '$lib/server/trusted-device';

// GET: generate a new TOTP secret and return QR code
export const GET: RequestHandler = async ({ locals }) => {
	const session = locals.session;
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const account = await loadTotpAccount(session);
	if (!account) return json({ error: 'Unauthorized' }, { status: 401 });

	// Re-enrolling would invalidate the existing authenticator entry, so an
	// account that already has 2FA must verify instead of setting up again.
	if (account.totpEnabled) {
		return json({ error: 'Two-factor authentication is already enabled' }, { status: 409 });
	}

	const secret = new Secret({ size: 20 });
	const totp = new TOTP({
		issuer: TOTP_ISSUER,
		label: account.email,
		secret,
		digits: 6,
		period: 30
	});

	const otpauthUrl = totp.toString();
	const QRCode = (await import('qrcode')).default;
	const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

	// Stored as a pending secret — totpEnabled only flips once a code from it
	// verifies, so an abandoned setup can't lock the account out.
	await saveTotpSecret(session.role, account.id, secret.base32);

	return json({ qrDataUrl, secret: secret.base32, otpauthUrl });
};

// POST: confirm code to finalize TOTP setup
export const POST: RequestHandler = async ({ request, locals, cookies, getClientAddress }) => {
	const session = locals.session;
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const account = await loadTotpAccount(session);
	if (!account) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => null);
	const result = safeParse(TotpSchema, body);
	if (!result.success) {
		return json({ error: 'Invalid code format' }, { status: 400 });
	}

	if (!account.totpSecret) {
		return json({ error: 'No pending TOTP secret' }, { status: 400 });
	}

	if (!verifyTotpCode(account.totpSecret, result.output.code)) {
		return json({ error: 'Invalid code — try again' }, { status: 401 });
	}

	await enableTotp(session.role, account.id);
	await updateSessionTotp(session.id);
	if (result.output.remember) {
		await trustDevice(cookies, account.id, session.role, getClientAddress(), request.headers.get('user-agent') ?? undefined);
	}
	return json({ ok: true, redirect: account.redirect });
};
