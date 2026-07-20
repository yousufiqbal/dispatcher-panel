import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { accountants, accountantStoreAccess } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { AccountantUpdateSchema } from '$lib/schemas/accountant';
import { hash } from 'argon2';
import { logAudit } from '$lib/server/audit';
import { isEmailTakenElsewhere } from '$lib/server/email-availability';

export const load: PageServerLoad = async ({ params }) => {
	const accountant = await db.query.accountants.findFirst({ where: eq(accountants.id, params.id) });
	if (!accountant) throw error(404, 'Accountant not found');

	const access = await db
		.select({ storeId: accountantStoreAccess.storeId })
		.from(accountantStoreAccess)
		.where(eq(accountantStoreAccess.accountantId, params.id));

	return {
		accountant: { ...accountant, passwordHash: undefined },
		storeCount: access.length
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const raw = {
			name: fd.get('name') as string,
			email: fd.get('email') as string,
			password: (fd.get('password') as string) || undefined,
			storeIds: [],
			isActive: fd.get('isActive') === 'true'
		};

		const result = safeParse(AccountantUpdateSchema, raw);
		if (!result.success) {
			return fail(400, { errors: result.issues.map((i) => i.message) });
		}

		if (await isEmailTakenElsewhere(result.output.email, 'accounting', params.id)) {
			return fail(400, { errors: ['Email is already in use by another account'] });
		}

		const updateData: Record<string, unknown> = {
			name: result.output.name,
			email: result.output.email,
			isActive: result.output.isActive,
			updatedAt: new Date()
		};
		if (result.output.password) {
			updateData.passwordHash = await hash(result.output.password);
		}

		await db.update(accountants).set(updateData).where(eq(accountants.id, params.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'accountant.update', {
				targetType: 'accountant',
				targetId: params.id
			});
		}
		return { success: true };
	},

	delete: async ({ params, locals }) => {
		await db.delete(accountants).where(eq(accountants.id, params.id));
		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'accountant.delete', {
				targetType: 'accountant',
				targetId: params.id
			});
		}
		throw redirect(303, '/admin/accountants');
	}
};
