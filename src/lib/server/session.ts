import { randomBytes } from 'crypto';
import { db } from '$lib/server/db';
import { sessions, dispatchers } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'dp_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Every account is a dispatcher; the owner additionally manages the team and
// sees the activity log.
export type SessionUser = {
	role: 'dispatcher';
	id: string;
	email: string;
	name: string;
	isActive: boolean;
	isOwner: boolean;
	totpEnabled: boolean;
};

export interface SessionData {
	id: string;
	userId: string;
	role: 'admin' | 'dispatcher';
	totpVerified: boolean;
	expiresAt: Date;
	user: SessionUser;
}

export async function createSession(
	userId: string,
	role: 'admin' | 'dispatcher',
	totpVerified: boolean,
	ipAddress?: string,
	userAgent?: string
): Promise<string> {
	const id = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

	await db.insert(sessions).values({ id, userId, role, totpVerified, expiresAt, ipAddress, userAgent });
	return id;
}

export async function updateSessionTotp(sessionId: string): Promise<void> {
	await db.update(sessions).set({ totpVerified: true }).where(eq(sessions.id, sessionId));
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function loadSession(sessionId: string): Promise<SessionData | null> {
	const session = await db.query.sessions.findFirst({
		where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date()))
	});
	if (!session) return null;

	// Sessions from the removed admin panel (or older modules) have no account.
	if (session.role !== 'dispatcher') return null;
	const d = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, session.userId) });
	if (!d || !d.isActive) return null;
	const user: SessionUser = {
		role: 'dispatcher',
		id: d.id,
		email: d.email,
		name: d.name,
		isActive: d.isActive,
		isOwner: d.isOwner,
		totpEnabled: d.totpEnabled
	};

	return {
		id: session.id,
		userId: session.userId,
		role: session.role,
		totpVerified: session.totpVerified,
		expiresAt: session.expiresAt,
		user
	};
}

export function setSessionCookie(cookies: Cookies, sessionId: string, expiresAt: Date): void {
	cookies.set(SESSION_COOKIE, sessionId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
