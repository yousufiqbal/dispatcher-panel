import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, dispatcherStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { DispatcherCreateSchema } from '$lib/schemas/dispatcher';
import { hash } from 'argon2';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async () => {
	const allStores = await db
		.select({ id: stores.id, nickname: stores.nickname, name: stores.name })
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

		const result = safeParse(DispatcherCreateSchema, raw);
		if (!result.success) {
			return fail(400, {
				errors: result.issues.map((i) => i.message),
				values: { name: raw.name, email: raw.email, storeIds }
			});
		}

		const passwordHash = await hash(result.output.password);
		const [newDispatcher] = await db
			.insert(dispatchers)
			.values({ name: result.output.name, email: result.output.email, passwordHash })
			.returning({ id: dispatchers.id });

		if (result.output.storeIds.length > 0) {
			await db.insert(dispatcherStoreAccess).values(
				result.output.storeIds.map((storeId) => ({ dispatcherId: newDispatcher.id, storeId }))
			);
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'dispatcher.create', {
				targetType: 'dispatcher',
				targetId: newDispatcher.id,
				metadata: { name: result.output.name, email: result.output.email }
			});
		}

		throw redirect(303, '/admin/dispatchers');
	}
};
