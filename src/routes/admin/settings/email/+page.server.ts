import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admin } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals }) => {
	const a = await db.query.admin.findFirst({ where: eq(admin.id, locals.session!.userId) });
	return { email: a!.email };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const fd = await request.formData();
		const email = fd.get('email') as string;
		if (!email || !email.includes('@')) return fail(400, { emailError: 'Valid email required' });

		await db.update(admin).set({ email, updatedAt: new Date() }).where(eq(admin.id, locals.session!.userId));
		await logAudit(locals.session!.userId, 'admin', 'admin.updateEmail');
		return { emailSuccess: true, email };
	}
};
