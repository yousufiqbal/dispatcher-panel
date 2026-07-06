import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admin } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals }) => {
	const a = await db.query.admin.findFirst({ where: eq(admin.id, locals.session!.userId) });

	return {
		email: a!.email,
		totpEnabled: a!.totpEnabled
	};
};

export const actions: Actions = {
	disableTotp: async ({ locals }) => {
		await db.update(admin).set({ totpEnabled: false, totpSecret: null, updatedAt: new Date() }).where(eq(admin.id, locals.session!.userId));
		await logAudit(locals.session!.userId, 'admin', 'admin.disableTotp');
		return { totpDisabled: true };
	}
};
