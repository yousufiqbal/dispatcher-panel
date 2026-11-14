import { db } from '$lib/server/db';
import { dispatchers } from '$lib/server/db/schema';
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

// Every account (owner included) is a dispatcher, so 2FA always lives on the
// dispatchers table.
export async function loadTotpAccount(session: SessionData): Promise<TotpAccount | null> {
	if (session.role === 'dispatcher') {
		const d = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, session.userId) });
		if (!d || !d.isActive) return null;
		return { id: d.id, email: d.email, totpSecret: d.totpSecret, totpEnabled: d.totpEnabled, redirect: '/dispatcher' };
	}
	return null;
}

export async function saveTotpSecret(role: SessionData['role'], userId: string, secret: string): Promise<void> {
	if (role !== 'dispatcher') return;
	await db.update(dispatchers).set({ totpSecret: secret, totpEnabled: false }).where(eq(dispatchers.id, userId));
}

export async function enableTotp(role: SessionData['role'], userId: string): Promise<void> {
	if (role !== 'dispatcher') return;
	await db.update(dispatchers).set({ totpEnabled: true }).where(eq(dispatchers.id, userId));
}

// `window: 1` accepts the neighbouring 30s steps, covering ordinary clock drift.
export function verifyTotpCode(secret: string, code: string): boolean {
	const totp = new TOTP({ secret, digits: 6, period: 30 });
	return totp.validate({ token: code, window: 1 }) !== null;
}
