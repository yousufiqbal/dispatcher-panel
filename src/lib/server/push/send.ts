import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { dispatcherPushSubscriptions, dispatcherStoreAccess, dispatchers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

let configured = false;

function ensureConfigured() {
	if (configured) return;
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
		throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be set');
	}
	webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
	configured = true;
}

export async function notifyStoreDispatchers(storeId: string, payload: { title: string; body: string; tag?: string; url?: string }) {
	ensureConfigured();

	const subs = await db
		.select({
			id: dispatcherPushSubscriptions.id,
			endpoint: dispatcherPushSubscriptions.endpoint,
			p256dh: dispatcherPushSubscriptions.p256dh,
			auth: dispatcherPushSubscriptions.auth
		})
		.from(dispatcherPushSubscriptions)
		.innerJoin(dispatchers, eq(dispatchers.id, dispatcherPushSubscriptions.dispatcherId))
		.innerJoin(
			dispatcherStoreAccess,
			and(eq(dispatcherStoreAccess.dispatcherId, dispatchers.id), eq(dispatcherStoreAccess.storeId, storeId))
		)
		.where(eq(dispatchers.isActive, true));

	const body = JSON.stringify(payload);

	await Promise.all(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					body
				);
			} catch (err) {
				const statusCode = (err as { statusCode?: number }).statusCode;
				if (statusCode === 404 || statusCode === 410) {
					await db.delete(dispatcherPushSubscriptions).where(eq(dispatcherPushSubscriptions.id, sub.id));
				}
			}
		})
	);
}
