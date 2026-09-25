import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeParse } from 'valibot';
import { TotpSchema } from '$lib/schemas/auth';
import { updateSessionTotp } from '$lib/server/session';
import { loadTotpAccount, verifyTotpCode } from '$lib/server/totp';
import { trustDevice } from '$lib/server/trusted-device';

export const POST: RequestHandler = async ({ request, locals, cookies, getClientAddress }) => {
	const session = locals.session;
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const account = await loadTotpAccount(session);
	if (!account) return json({ error: 'Unauthorized' }, { status: 401 });

	if (session.totpVerified) {
		return json({ ok: true, redirect: account.redirect });
	}

	const body = await request.json().catch(() => null);
	const result = safeParse(TotpSchema, body);
	if (!result.success) {
		return json({ error: 'Invalid code format' }, { status: 400 });
	}

	if (!account.totpSecret || !account.totpEnabled) {
		return json({ error: 'TOTP not configured' }, { status: 400 });
	}

	if (!verifyTotpCode(account.totpSecret, result.output.code)) {
		return json({ error: 'Invalid code' }, { status: 401 });
	}

	await updateSessionTotp(session.id);
	if (result.output.remember) {
		await trustDevice(cookies, account.id, session.role, getClientAddress(), request.headers.get('user-agent') ?? undefined);
	}
	return json({ ok: true, redirect: account.redirect });
};
