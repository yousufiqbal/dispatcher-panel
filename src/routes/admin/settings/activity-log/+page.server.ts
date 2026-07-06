import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { activityLogSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ACTIVITY_TYPES, defaultEnabled } from '$lib/server/activity-types';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async () => {
	const rows = await db.query.activityLogSettings.findMany();
	const overrides = new Map(rows.map((r) => [r.action, r.enabled]));

	const activityTypes = ACTIVITY_TYPES.map((t) => ({
		...t,
		enabled: overrides.has(t.action) ? overrides.get(t.action)! : defaultEnabled(t.action)
	}));

	return { activityTypes };
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		const fd = await request.formData();
		const action = fd.get('action') as string;
		const enabled = fd.get('enabled') === 'true';

		await db
			.insert(activityLogSettings)
			.values({ action, enabled })
			.onConflictDoUpdate({ target: activityLogSettings.action, set: { enabled } });

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'activityLog.settingsUpdate', { targetType: 'activityType', targetId: action, metadata: { enabled } });
		}
		return { saved: action };
	}
};
