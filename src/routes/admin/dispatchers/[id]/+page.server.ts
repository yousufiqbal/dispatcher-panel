import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, dispatcherStoreAccess } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { DispatcherUpdateSchema } from '$lib/schemas/dispatcher';
import { hash } from 'argon2';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const dispatcher = await db.query.dispatchers.findFirst({ where: eq(dispatchers.id, params.id) });
	if (!dispatcher) throw error(404, 'Dispatcher not found');

	const access = await db
		.select({ storeId: dispatcherStoreAccess.storeId })
		.from(dispatcherStoreAccess)
		.where(eq(dispatcherStoreAccess.dispatcherId, params.id));

	return {
		dispatcher: { ...dispatcher, passwordHash: undefined },
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

		const result = safeParse(DispatcherUpdateSchema, raw);
		if (!result.success) {
			return fail(400, { errors: result.issues.map((i) => i.message) });
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

		await db.update(dispatchers).set(updateData).where(eq(dispatchers.id, params.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'dispatcher.update', {
				targetType: 'dispatcher',
				targetId: params.id
			});
		}
		return { success: true };
	},

	delete: async ({ params, locals }) => {
		await db.delete(dispatchers).where(eq(dispatchers.id, params.id));
		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'dispatcher.delete', {
				targetType: 'dispatcher',
				targetId: params.id
			});
		}
		throw redirect(303, '/admin/dispatchers');
	}
};
