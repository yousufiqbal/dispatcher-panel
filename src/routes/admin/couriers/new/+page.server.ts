import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { CourierCreateSchema } from '$lib/schemas/courier';
import { encrypt } from '$lib/server/crypto';
import { logAudit } from '$lib/server/audit';

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
			provider: fd.get('provider') as string,
			apiKey: (fd.get('apiKey') as string) ?? '',
			enabled: fd.get('enabled') === 'true',
			defaultWeight: (fd.get('defaultWeight') as string) ?? '',
			defaultFragile: fd.get('defaultFragile') === 'true',
			defaultNote: (fd.get('defaultNote') as string) ?? '',
			storeIds
		};

		const result = safeParse(CourierCreateSchema, raw);
		if (!result.success) {
			return fail(400, { errors: result.issues.map((i) => i.message), values: raw });
		}

		const [newCourier] = await db
			.insert(couriers)
			.values({
				name: result.output.name,
				provider: result.output.provider,
				apiKey: result.output.apiKey?.trim() ? encrypt(result.output.apiKey.trim()) : null,
				enabled: result.output.enabled,
				defaultWeight: result.output.defaultWeight?.trim() || null,
				defaultFragile: result.output.defaultFragile,
				defaultNote: result.output.defaultNote?.trim() || null
			})
			.returning({ id: couriers.id });

		if (result.output.storeIds.length > 0) {
			await db.insert(courierStoreAccess).values(
				result.output.storeIds.map((storeId) => ({ courierId: newCourier.id, storeId }))
			);
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'courier.create', {
				targetType: 'courier',
				targetId: newCourier.id,
				metadata: { name: result.output.name, provider: result.output.provider }
			});
		}

		throw redirect(303, '/admin/couriers');
	}
};
