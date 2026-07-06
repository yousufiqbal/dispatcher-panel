import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = locals.session;

	if (!session || session.role !== 'admin') {
		throw redirect(303, '/login');
	}

	// TOTP temporarily disabled

	return { admin: session.user };
};
