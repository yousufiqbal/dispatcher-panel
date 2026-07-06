import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admin, courierSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';
import { encrypt } from '$lib/server/crypto';
import type { CourierCode } from '$lib/server/courier';

export const load: PageServerLoad = async ({ locals }) => {
	const a = await db.query.admin.findFirst({ where: eq(admin.id, locals.session!.userId) });
	const couriers = await db.query.courierSettings.findMany();

	const byCode = (code: CourierCode) => {
		const c = couriers.find((c) => c.courier === code);
		return {
			enabled: c?.enabled ?? false,
			hasApiKey: !!c?.apiKey,
			defaultWeight: c?.defaultWeight ?? '',
			defaultFragile: c?.defaultFragile ?? false,
			defaultNote: c?.defaultNote ?? ''
		};
	};

	return {
		email: a!.email,
		totpEnabled: a!.totpEnabled,
		couriers: { postex: byCode('postex'), dex: byCode('dex') }
	};
};

export const actions: Actions = {
	disableTotp: async ({ locals }) => {
		await db.update(admin).set({ totpEnabled: false, totpSecret: null, updatedAt: new Date() }).where(eq(admin.id, locals.session!.userId));
		await logAudit(locals.session!.userId, 'admin', 'admin.disableTotp');
		return { totpDisabled: true };
	},

	saveCourier: async ({ request, locals }) => {
		const fd = await request.formData();
		const courier = fd.get('courier') as CourierCode;
		const enabled = fd.get('enabled') === 'true';
		const apiKey = (fd.get('apiKey') as string) ?? '';
		const defaultWeight = (fd.get('defaultWeight') as string) ?? '';
		const defaultFragile = fd.get('defaultFragile') === 'true';
		const defaultNote = (fd.get('defaultNote') as string) ?? '';

		const existing = await db.query.courierSettings.findFirst({ where: eq(courierSettings.courier, courier) });
		const apiKeyToStore = apiKey.trim() ? encrypt(apiKey.trim()) : (existing?.apiKey ?? null);

		await db
			.insert(courierSettings)
			.values({
				courier,
				enabled,
				apiKey: apiKeyToStore,
				defaultWeight: defaultWeight.trim() || null,
				defaultFragile,
				defaultNote: defaultNote.trim() || null,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: courierSettings.courier,
				set: {
					enabled,
					apiKey: apiKeyToStore,
					defaultWeight: defaultWeight.trim() || null,
					defaultFragile,
					defaultNote: defaultNote.trim() || null,
					updatedAt: new Date()
				}
			});

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'courier.settingsUpdate', { targetType: 'courier', targetId: courier });
		}
		return { courierSaved: courier };
	}
};
