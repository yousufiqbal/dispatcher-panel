import { db } from '$lib/server/db';
import { admin, dispatchers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { TOTP } from 'otpauth';
import type { SessionData } from '$lib/server/session';

export const TOTP_ISSUER = 'Pro Shipper';

export interface TotpAccount {
	id: string;
	email: string;
	totpSecret: string | null;
	totpEnabled: boolean;
	redirect: string;
}

// Admins and dispatchers both carry TOTP columns, on separate tables. This
// keeps the endpoints table-agnostic so the same enrol/verify flow serves
// either role. Accounting has no 2FA yet and is rejected.
export async function loadTotpAccount(session: SessionData): Promise<TotpAccount | null> {
	if (session.role === 'admin') {
		const a = await db.query.admin.findFirst({ where: eq(admin.id, session.userId) });
		return a ? { id: a.id, email: a.email, totpSecret: a.totpSecret, totpEnabled: a.totpEnabled, redirect: '/admin' } : null;
	}
	if (session.role === 'dispatcher') {
		const d = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, session.userId) });
		if (!d || !d.isActive) return null;
		return { id: d.id, email: d.email, totpSecret: d.totpSecret, totpEnabled: d.totpEnabled, redirect: '/dispatcher' };
	}
	return null;
}

export async function saveTotpSecret(role: SessionData['role'], userId: string, secret: string): Promise<void> {
	if (role === 'admin') {
		await db.update(admin).set({ totpSecret: secret, totpEnabled: false }).where(eq(admin.id, userId));
	} else if (role === 'dispatcher') {
		await db.update(dispatchers).set({ totpSecret: secret, totpEnabled: false }).where(eq(dispatchers.id, userId));
	}
}

export async function enableTotp(role: SessionData['role'], userId: string): Promise<void> {
	if (role === 'admin') {
		await db.update(admin).set({ totpEnabled: true }).where(eq(admin.id, userId));
	} else if (role === 'dispatcher') {
		await db.update(dispatchers).set({ totpEnabled: true }).where(eq(dispatchers.id, userId));
	}
}

// `window: 1` accepts the neighbouring 30s steps, covering ordinary clock drift.
export function verifyTotpCode(secret: string, code: string): boolean {
	const totp = new TOTP({ secret, digits: 6, period: 30 });
	return totp.validate({ token: code, window: 1 }) !== null;
}
