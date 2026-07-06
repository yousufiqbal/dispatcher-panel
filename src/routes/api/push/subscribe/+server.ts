import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dispatcherPushSubscriptions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session || locals.session.role !== 'dispatcher') throw error(401, 'Unauthorized');

	const body = (await request.json()) as {
		endpoint: string;
		keys: { p256dh: string; auth: string };
	};
	if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) throw error(400, 'Invalid subscription');

	await db
		.insert(dispatcherPushSubscriptions)
		.values({
			dispatcherId: locals.session.userId,
			endpoint: body.endpoint,
			p256dh: body.keys.p256dh,
			auth: body.keys.auth
		})
		.onConflictDoUpdate({
			target: dispatcherPushSubscriptions.endpoint,
			set: { dispatcherId: locals.session.userId, p256dh: body.keys.p256dh, auth: body.keys.auth }
		});

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');

	const body = (await request.json()) as { endpoint: string };
	if (!body.endpoint) throw error(400, 'Missing endpoint');

	await db.delete(dispatcherPushSubscriptions).where(eq(dispatcherPushSubscriptions.endpoint, body.endpoint));

	return json({ success: true });
};
