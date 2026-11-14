import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireOwner } from '$lib/server/owner';
import { logAudit } from '$lib/server/audit';

// One store per deployment — settings apply to it.
async function theStore() {
	const store = await db.query.stores.findFirst({ where: eq(stores.isActive, true) });
	if (!store) error(404, 'No store is set up yet');
	return store;
}

function parseDays(value: FormDataEntryValue | null): number | null {
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireOwner(locals.session);
	const store = await theStore();
	return { airLeadDays: store.airLeadDays, seaLeadDays: store.seaLeadDays };
};

export const actions: Actions = {
	leadTimes: async ({ request, locals }) => {
		const session = requireOwner(locals.session);
		const store = await theStore();
		const fd = await request.formData();
		const air = parseDays(fd.get('airLeadDays'));
		const sea = parseDays(fd.get('seaLeadDays'));
		if (air === null || sea === null) return fail(400, { error: 'Lead times must be whole days between 1 and 365' });

		await db.update(stores).set({ airLeadDays: air, seaLeadDays: sea, updatedAt: new Date() }).where(eq(stores.id, store.id));
		await logAudit(session.userId, 'dispatcher', 'settings.update', {
			targetType: 'store',
			targetId: store.id,
			storeId: store.id,
			metadata: { airLeadDays: air, seaLeadDays: sea }
		});
		return { saved: true };
	}
};
