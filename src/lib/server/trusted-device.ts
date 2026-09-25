import { randomBytes, createHash } from 'crypto';
import { db } from '$lib/server/db';
import { trustedDevices } from '$lib/server/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';

export const TRUSTED_DEVICE_COOKIE = 'dp_trust';
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Role = 'admin' | 'dispatcher';

// Only the hash lands in the DB — the raw token lives in the cookie alone.
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

// Issues a new device token and sets the cookie. Called after a successful
// TOTP check when the user ticked "remember this device".
export async function trustDevice(
	cookies: Cookies,
	userId: string,
	role: Role,
	ipAddress?: string,
	userAgent?: string
): Promise<void> {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);

	await db.insert(trustedDevices).values({ userId, role, tokenHash: hashToken(token), expiresAt, ipAddress, userAgent });

	cookies.set(TRUSTED_DEVICE_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		expires: expiresAt
	});
}

// True when this browser holds a live token belonging to this exact user —
// the user id is part of the match, so a token can't carry over to another
// account signing in from the same machine.
export async function isDeviceTrusted(cookies: Cookies, userId: string, role: Role): Promise<boolean> {
	const token = cookies.get(TRUSTED_DEVICE_COOKIE);
	if (!token) return false;

	const [row] = await db
		.select({ id: trustedDevices.id })
		.from(trustedDevices)
		.where(
			and(
				eq(trustedDevices.tokenHash, hashToken(token)),
				eq(trustedDevices.userId, userId),
				eq(trustedDevices.role, role),
				gt(trustedDevices.expiresAt, new Date())
			)
		);
	if (!row) return false;

	await db.update(trustedDevices).set({ lastUsedAt: new Date() }).where(eq(trustedDevices.id, row.id));
	return true;
}

// Drops this browser's token — used when a device turns out to be untrusted
// (revoked, expired) so the stale cookie doesn't linger.
export async function forgetDevice(cookies: Cookies): Promise<void> {
	const token = cookies.get(TRUSTED_DEVICE_COOKIE);
	if (token) {
		await db.delete(trustedDevices).where(eq(trustedDevices.tokenHash, hashToken(token)));
	}
	cookies.delete(TRUSTED_DEVICE_COOKIE, { path: '/' });
}

// Revokes every remembered device for a user — e.g. after resetting their 2FA.
export async function revokeTrustedDevices(userId: string): Promise<void> {
	await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));
}

export async function purgeExpiredTrustedDevices(): Promise<void> {
	await db.delete(trustedDevices).where(lt(trustedDevices.expiresAt, new Date()));
}
