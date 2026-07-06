import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { admin } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash, verify } from 'argon2';
import { logAudit } from '$lib/server/audit';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const fd = await request.formData();
		const current = fd.get('currentPassword') as string;
		const newPass = fd.get('newPassword') as string;
		const confirm = fd.get('confirmPassword') as string;

		if (newPass.length < 10) return fail(400, { passError: 'New password must be at least 10 characters' });
		if (newPass !== confirm) return fail(400, { passError: 'Passwords do not match' });

		const a = await db.query.admin.findFirst({ where: eq(admin.id, locals.session!.userId) });
		const valid = await verify(a!.passwordHash, current).catch(() => false);
		if (!valid) return fail(400, { passError: 'Current password incorrect' });

		const passwordHash = await hash(newPass);
		await db.update(admin).set({ passwordHash, updatedAt: new Date() }).where(eq(admin.id, locals.session!.userId));
		await logAudit(locals.session!.userId, 'admin', 'admin.updatePassword');
		return { passSuccess: true };
	}
};
