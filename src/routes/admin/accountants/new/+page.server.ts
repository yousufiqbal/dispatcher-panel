import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { accountants, accountantStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { AccountantCreateSchema } from '$lib/schemas/accountant';
import { hash } from 'argon2';
import { logAudit } from '$lib/server/audit';
import { isEmailTakenElsewhere } from '$lib/server/email-availability';

export const load: PageServerLoad = async () => {
	const allStores = await db
		.select({ id: stores.id, name: stores.name })
		.from(stores)
		.where(eq(stores.isActive, true));
	return { stores: allStores };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const fd = await request.formData();
		const storeIds = fd.getAll('storeIds') as string[];
		const raw = {
			name: fd.get('name') as string,
			email: fd.get('email') as string,
			password: fd.get('password') as string,
			storeIds
		};

		const result = safeParse(AccountantCreateSchema, raw);
		if (!result.success) {
			return fail(400, {
				errors: result.issues.map((i) => i.message),
				values: { name: raw.name, email: raw.email, storeIds }
			});
		}

		if (await isEmailTakenElsewhere(result.output.email, 'accounting')) {
			return fail(400, {
				errors: ['Email is already in use by another account'],
				values: { name: raw.name, email: raw.email, storeIds }
			});
		}

		const passwordHash = await hash(result.output.password);
		const [newAccountant] = await db
			.insert(accountants)
			.values({ name: result.output.name, email: result.output.email, passwordHash })
			.returning({ id: accountants.id });

		if (result.output.storeIds.length > 0) {
			await db.insert(accountantStoreAccess).values(
				result.output.storeIds.map((storeId) => ({ accountantId: newAccountant.id, storeId }))
			);
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'accountant.create', {
				targetType: 'accountant',
				targetId: newAccountant.id,
				metadata: { name: result.output.name, email: result.output.email }
			});
		}

		throw redirect(303, '/admin/accountants');
	}
};
