import { db } from '$lib/server/db';
import { auditLog, activityLogSettings } from '$lib/server/db/schema';
import { defaultEnabled } from '$lib/server/activity-types';

let cache: Map<string, boolean> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

async function isActionEnabled(action: string): Promise<boolean> {
	if (!cache || Date.now() > cacheExpiresAt) {
		const rows = await db.query.activityLogSettings.findMany();
		cache = new Map(rows.map((r) => [r.action, r.enabled]));
		cacheExpiresAt = Date.now() + CACHE_TTL_MS;
	}
	return cache.has(action) ? cache.get(action)! : defaultEnabled(action);
}

export async function logAudit(
	actorId: string,
	actorRole: 'admin' | 'dispatcher',
	action: string,
	options: {
		targetType?: string;
		targetId?: string;
		storeId?: string;
		metadata?: Record<string, unknown>;
	} = {}
): Promise<void> {
	if (!(await isActionEnabled(action))) return;

	await db.insert(auditLog).values({
		actorId,
		actorRole,
		action,
		targetType: options.targetType,
		targetId: options.targetId,
		storeId: options.storeId,
		metadata: options.metadata ? JSON.stringify(options.metadata) : undefined
	});
}
