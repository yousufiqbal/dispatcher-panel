import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { COURIER_LABELS, getPostExOrders } from '$lib/server/courier';
import { decrypt } from '$lib/server/crypto';

const PERIOD_DAYS: Record<string, number | null> = {
	today: 0,
	'7d': 7,
	'30d': 30,
	'365d': 365,
	all: null
};

function toDateStr(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function periodCutoff(period: string): Date | null {
	const days = PERIOD_DAYS[period] ?? 30;
	if (days === null) return null;
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - days);
	return start;
}

// Always fetches a 365-day window (superset of every period tab except "all") in one
// PostEx call, then period/status filtering happens locally — avoids a re-fetch per tab.
function fetchWindow(period: string): { fromDate: string; toDate: string } {
	const toDate = new Date();
	const fromDate = new Date();
	if (period === 'all') fromDate.setFullYear(fromDate.getFullYear() - 2); // PostEx has no unbounded range option
	else fromDate.setDate(fromDate.getDate() - 365);
	return { fromDate: toDateStr(fromDate), toDate: toDateStr(toDate) };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const period = url.searchParams.get('period') ?? '30d';
	const status = url.searchParams.get('status') ?? '';

	const storeCouriers = await db
		.select({ id: couriers.id, name: couriers.name, provider: couriers.provider, apiKey: couriers.apiKey })
		.from(courierStoreAccess)
		.innerJoin(couriers, eq(couriers.id, courierStoreAccess.courierId))
		.where(eq(courierStoreAccess.storeId, params.storeId));

	const courierId = url.searchParams.get('courierId') || storeCouriers[0]?.id || '';
	const courier = storeCouriers.find((c) => c.id === courierId);

	type Booking = {
		orderName: string;
		courierName: string;
		trackingId: string;
		codAmount: string | null;
		status: string | null;
		city: string | null;
		note: string | null;
		createdAt: Date;
	};

	let allBookings: Booking[] = [];
	let error: string | null = null;

	if (!courier) {
		error = 'No courier assigned to this store';
	} else if (!courier.apiKey) {
		error = `${courier.name} is missing an API key`;
	} else if (courier.provider !== 'postex') {
		error = `Live booking lookup isn't supported for ${COURIER_LABELS[courier.provider]} yet`;
	} else {
		const { fromDate, toDate } = fetchWindow(period);
		try {
			const rows = await getPostExOrders(decrypt(courier.apiKey), fromDate, toDate);
			allBookings = rows.map((r) => ({
				orderName: r.orderRefNumber,
				courierName: courier.name,
				trackingId: r.trackingNumber,
				codAmount: r.invoicePayment != null ? String(r.invoicePayment) : null,
				status: r.transactionStatus,
				city: r.cityName,
				note: r.transactionNotes,
				createdAt: new Date(r.transactionDate)
			}));
			allBookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch bookings from PostEx';
		}
	}

	const statuses = [...new Set(allBookings.map((b) => b.status).filter((s): s is string => !!s))].sort();

	const cutoff = periodCutoff(period);
	let bookings = cutoff ? allBookings.filter((b) => b.createdAt >= cutoff) : allBookings;
	if (status) bookings = bookings.filter((b) => b.status === status);

	return {
		couriers: storeCouriers.map((c) => ({ id: c.id, name: c.name, providerLabel: COURIER_LABELS[c.provider] })),
		period,
		courierId,
		status,
		statuses,
		bookings,
		error
	};
};
