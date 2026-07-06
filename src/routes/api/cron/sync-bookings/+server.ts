import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { couriers, courierBookings } from '$lib/server/db/schema';
import { eq, and, or, isNull, notInArray } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';
import { getPostExBulkTrackingStatus } from '$lib/server/courier';

const TERMINAL_STATUSES = ['Delivered', 'Returned'];
const CHUNK_SIZE = 20;

function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
	return chunks;
}

export const GET: RequestHandler = async ({ url, request }) => {
	const secret = url.searchParams.get('secret') ?? request.headers.get('x-cron-secret');
	if (!env.CRON_SECRET || secret !== env.CRON_SECRET) throw error(401, 'Unauthorized');

	const activeCouriers = await db
		.select()
		.from(couriers)
		.where(and(eq(couriers.provider, 'postex'), eq(couriers.enabled, true)));

	let updated = 0;
	let checked = 0;

	for (const courier of activeCouriers) {
		if (!courier.apiKey) continue;

		const pending = await db
			.select({ id: courierBookings.id, trackingId: courierBookings.trackingId })
			.from(courierBookings)
			.where(
				and(
					eq(courierBookings.courierId, courier.id),
					or(isNull(courierBookings.status), notInArray(courierBookings.status, TERMINAL_STATUSES))
				)
			);

		if (pending.length === 0) continue;

		const apiKey = decrypt(courier.apiKey);
		const byTrackingId = new Map(pending.map((p) => [p.trackingId, p.id]));

		for (const batch of chunk(pending.map((p) => p.trackingId), CHUNK_SIZE)) {
			checked += batch.length;
			try {
				const statuses = await getPostExBulkTrackingStatus(apiKey, batch);
				for (const [trackingId, status] of statuses) {
					const bookingId = byTrackingId.get(trackingId);
					if (!bookingId) continue;
					await db
						.update(courierBookings)
						.set({ status, statusUpdatedAt: new Date() })
						.where(eq(courierBookings.id, bookingId));
					updated++;
				}
			} catch (err) {
				console.error('[booking status sync failed]', courier.name, err);
			}
		}
	}

	return json({ checked, updated });
};
