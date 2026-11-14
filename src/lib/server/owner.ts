import { error, redirect } from '@sveltejs/kit';
import type { SessionData } from './session';

// Team, Activity and Settings are owner-only. Pages and their form actions both
// call this — actions don't run the layout's checks.
export function requireOwner(session: SessionData | null): SessionData {
	if (!session || session.role !== 'dispatcher' || !session.totpVerified) redirect(303, '/login');
	if (!session.user.isOwner) error(403, 'Only the owner can open this page');
	return session;
}
