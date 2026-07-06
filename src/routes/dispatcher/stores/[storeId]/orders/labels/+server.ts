import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PDFDocument } from 'pdf-lib';
import { db } from '$lib/server/db';
import { couriers, courierBookings } from '$lib/server/db/schema';
import { eq, and, or, inArray, ne, isNull, desc } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';
import { getPostExAirwayBill } from '$lib/server/courier';
import { getAuthorizedStore } from '$lib/server/store-access';
import { logAudit } from '$lib/server/audit';

function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
	return chunks;
}

// Streams a single merged PDF of airway bills for the given order ids.
// GET /dispatcher/stores/[storeId]/orders/labels?ids=<orderId>,<orderId>,...
export const GET: RequestHandler = async ({ params, url, locals }) => {
	await getAuthorizedStore(locals.session, params.storeId);

	const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
	if (ids.length === 0) throw error(400, 'No order ids given');

	const bookings = await db
		.select({
			orderId: courierBookings.orderId,
			orderName: courierBookings.orderName,
			trackingId: courierBookings.trackingId,
			courierId: courierBookings.courierId,
			createdAt: courierBookings.createdAt,
			courierName: couriers.name,
			provider: couriers.provider,
			apiKey: couriers.apiKey
		})
		.from(courierBookings)
		.leftJoin(couriers, eq(couriers.id, courierBookings.courierId))
		.where(
			and(
				eq(courierBookings.storeId, params.storeId),
				inArray(courierBookings.orderId, ids),
				or(isNull(courierBookings.status), ne(courierBookings.status, 'Cancelled'))
			)
		)
		.orderBy(desc(courierBookings.createdAt));

	// An order can have stale duplicate booking rows (failed-then-retried bookings) —
	// print only the newest booking per order, one label each.
	const latestPerOrder = new Map<string, (typeof bookings)[number]>();
	for (const b of bookings) {
		if (!latestPerOrder.has(b.orderId)) latestPerOrder.set(b.orderId, b);
	}

	const active = [...latestPerOrder.values()].filter((b) => b.trackingId);
	if (active.length === 0) throw error(404, 'No bookings found for the selected orders');

	// Group tracking numbers by courier account — each account has its own API key,
	// and PostEx caps airway bills at 10 tracking numbers per request.
	const byCourier = new Map<string, { apiKey: string; provider: string; name: string; trackingIds: string[] }>();
	const skipped: string[] = [];
	for (const b of active) {
		if (!b.courierId || !b.apiKey) {
			skipped.push(b.orderName);
			continue;
		}
		if (b.provider !== 'postex') {
			skipped.push(`${b.orderName} (${b.courierName ?? b.provider} labels not supported yet)`);
			continue;
		}
		const entry = byCourier.get(b.courierId) ?? { apiKey: b.apiKey, provider: b.provider, name: b.courierName ?? 'PostEx', trackingIds: [] };
		entry.trackingIds.push(b.trackingId);
		byCourier.set(b.courierId, entry);
	}

	if (byCourier.size === 0) {
		throw error(400, skipped.length ? `No printable labels: ${skipped.join(', ')}` : 'No printable labels');
	}

	const pdfBuffers: Uint8Array[] = [];
	for (const { apiKey, trackingIds } of byCourier.values()) {
		const key = decrypt(apiKey);
		for (const batch of chunk(trackingIds, 10)) {
			try {
				pdfBuffers.push(await getPostExAirwayBill(key, batch));
			} catch (e) {
				throw error(502, `Courier label fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
			}
		}
	}

	// Single batch → stream it straight through; multiple → merge into one document.
	let out: Uint8Array;
	if (pdfBuffers.length === 1) {
		out = pdfBuffers[0];
	} else {
		const merged = await PDFDocument.create();
		for (const buf of pdfBuffers) {
			const doc = await PDFDocument.load(buf);
			const pages = await merged.copyPages(doc, doc.getPageIndices());
			for (const p of pages) merged.addPage(p);
		}
		out = await merged.save();
	}

	if (locals.session) {
		await logAudit(locals.session.userId, 'dispatcher', 'order.printLabels', {
			targetType: 'order', storeId: params.storeId, metadata: { count: active.length }
		});
	}

	const disposition = url.searchParams.get('download') ? 'attachment' : 'inline';
	return new Response(new Uint8Array(out), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `${disposition}; filename="labels-${new Date().toISOString().slice(0, 10)}.pdf"`
		}
	});
};
