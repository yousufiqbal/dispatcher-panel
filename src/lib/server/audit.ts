import { db } from '$lib/server/db';
import { auditLog } from '$lib/server/db/schema';

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
