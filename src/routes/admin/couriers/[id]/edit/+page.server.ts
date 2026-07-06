import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '$lib/server/crypto';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ params }) => {
	const courier = await db.query.couriers.findFirst({ where: eq(couriers.id, params.id) });
	if (!courier) throw error(404, 'Courier not found');

	return {
		courier: { ...courier, apiKey: undefined, hasApiKey: !!courier.apiKey }
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const name = (fd.get('name') as string)?.trim();
		const provider = fd.get('provider') as string;
		const apiKey = ((fd.get('apiKey') as string) ?? '').trim();
		const enabled = fd.get('enabled') === 'true';
		const defaultWeight = ((fd.get('defaultWeight') as string) ?? '').trim();
		const defaultFragile = fd.get('defaultFragile') === 'true';
		const defaultNote = ((fd.get('defaultNote') as string) ?? '').trim();

		if (!name) return fail(400, { errors: ['Name is required'] });
		if (provider !== 'postex' && provider !== 'dex') return fail(400, { errors: ['Invalid provider'] });

		const existing = await db.query.couriers.findFirst({ where: eq(couriers.id, params.id) });
		if (!existing) throw error(404, 'Courier not found');

		await db
			.update(couriers)
			.set({
				name,
				provider,
				apiKey: apiKey ? encrypt(apiKey) : existing.apiKey,
				enabled,
				defaultWeight: defaultWeight || null,
				defaultFragile,
				defaultNote: defaultNote || null,
				updatedAt: new Date()
			})
			.where(eq(couriers.id, params.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'courier.update', { targetType: 'courier', targetId: params.id });
		}
		return { success: true };
	},

	delete: async ({ params, locals }) => {
		await db.delete(couriers).where(eq(couriers.id, params.id));
		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'courier.delete', { targetType: 'courier', targetId: params.id });
		}
		throw redirect(303, '/admin/couriers');
	}
};
