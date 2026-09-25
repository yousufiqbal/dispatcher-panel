import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	const existingAdmin = await db.query.admin.findFirst();
	const session = locals.session;

	// A dispatcher whose session exists but isn't TOTP-verified is mid-sign-in
	// (or reloaded the page) — drop them straight back on the right step rather
	// than making them retype their password.
	let pending: 'totp' | 'totp-setup' | null = null;
	if (session && session.role === 'dispatcher' && !session.totpVerified) {
		pending = session.user.role === 'dispatcher' && session.user.totpEnabled ? 'totp' : 'totp-setup';
	}

	return { hasAdmin: !!existingAdmin, pending };
};
