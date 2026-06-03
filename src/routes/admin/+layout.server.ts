import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = locals.session;

	if (!session || session.role !== 'admin') {
		throw redirect(303, '/login');
	}

	if (!session.totpVerified) {
		throw redirect(303, '/login');
	}

	if (session.user.role === 'admin' && !session.user.totpEnabled) {
		if (!url.pathname.includes('totp-setup')) {
			throw redirect(303, '/login');
		}
	}

	return { admin: session.user };
};
