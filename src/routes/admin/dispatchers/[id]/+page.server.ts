import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, dispatcherStoreAccess, stores, sessions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { revokeTrustedDevices } from '$lib/server/trusted-device';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const dispatcher = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, params.id) });
	if (!dispatcher) throw error(404, 'Dispatcher not found');

	const storeRows = await db
		.select({ id: stores.id, name: stores.name })
		.from(dispatcherStoreAccess)
		.innerJoin(stores, eq(stores.id, dispatcherStoreAccess.storeId))
		.where(eq(dispatcherStoreAccess.dispatcherId, params.id));

	return {
		dispatcher: { ...dispatcher, passwordHash: undefined },
		stores: storeRows
	};
};

export const actions: Actions = {
	// Lost/replaced authenticator. Clearing the secret drops them back into
	// mandatory enrolment on next sign-in; remembered devices and live sessions
	// are killed too, so the old phone can't keep anyone signed in.
	resetTotp: async ({ params, locals }) => {
		const dispatcher = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, params.id) });
		if (!dispatcher) return fail(404, { error: 'Dispatcher not found' });

		await db
			.update(dispatchers)
			.set({ totpSecret: null, totpEnabled: false, updatedAt: new Date() })
			.where(eq(dispatchers.id, params.id));
		await revokeTrustedDevices(params.id);
		await db.delete(sessions).where(and(eq(sessions.userId, params.id), eq(sessions.role, 'dispatcher')));

		if (locals.session) {
			await logAudit(locals.session.userId, locals.session.role, 'dispatcher.totpReset', {
				targetType: 'dispatcher',
				targetId: params.id,
				metadata: { email: dispatcher.email, name: dispatcher.name }
			});
		}

		return { reset: true };
	}
};
