export type CourierCode = 'postex' | 'dex';

export interface BookingParams {
	orderName: string;
	weight: string;
	codAmount: string;
	fragile: boolean;
	note: string;
	orderDetail: string;
	items: number;
	pickupAddressCode: string;
	shippingAddress: {
		name: string;
		address1: string;
		city: string;
		province: string;
		country: string;
		zip: string;
		phone: string | null;
	} | null;
}

export interface BookingResult {
	trackingId: string;
}

const POSTEX_CREATE_ORDER_URL = 'https://api.postex.pk/services/integration/api/order/v3/create-order';

interface PostExCreateOrderResponse {
	statusCode: string;
	statusMessage: string;
	dist?: { trackingNumber: string };
}

const POSTEX_PICKUP_ADDRESS_URL = 'https://api.postex.pk/services/integration/api/order/v1/get-merchant-address';

export interface PickupAddress {
	addressCode: string;
	address: string;
	cityName: string;
	contactPersonName: string;
	phone1: string;
	// Not in PostEx's published docs, but their merchant dashboard shows an
	// "Address Type" column (Pickup/Return Address, Return Address, Default
	// Address) — the live API response includes it even though the docs don't
	// mention it, so we read it defensively under every name it might use.
	addressType?: string;
}

interface PostExPickupAddressResponse {
	statusCode: string;
	statusMessage: string;
	dist?: Record<string, unknown>[];
}

const pickupAddressesCache = new Map<string, { at: number; addresses: PickupAddress[] }>();
const PICKUP_ADDRESS_CACHE_MS = 60 * 60 * 1000;

function readAddressType(raw: Record<string, unknown>): string | undefined {
	const value = raw.addressType ?? raw.addressTypeName ?? raw.type;
	return typeof value === 'string' ? value : undefined;
}

export async function getPostExPickupAddresses(apiKey: string): Promise<PickupAddress[]> {
	const cached = pickupAddressesCache.get(apiKey);
	if (cached && Date.now() - cached.at < PICKUP_ADDRESS_CACHE_MS) return cached.addresses;

	const res = await fetch(POSTEX_PICKUP_ADDRESS_URL, { headers: { token: apiKey } });
	const data = (await res.json()) as PostExPickupAddressResponse;
	if (!res.ok || !data.dist) throw new Error(data.statusMessage || 'Failed to fetch pickup addresses');

	const addresses: PickupAddress[] = data.dist.map((raw) => ({
		addressCode: String(raw.addressCode ?? ''),
		address: String(raw.address ?? ''),
		cityName: String(raw.cityName ?? ''),
		contactPersonName: String(raw.contactPersonName ?? ''),
		phone1: String(raw.phone1 ?? ''),
		addressType: readAddressType(raw)
	}));

	pickupAddressesCache.set(apiKey, { at: Date.now(), addresses });
	return addresses;
}

async function bookPostEx(apiKey: string, params: BookingParams): Promise<BookingResult> {
	const addr = params.shippingAddress;
	if (!params.pickupAddressCode) throw new Error('Pickup address is required');

	const body = {
		orderRefNumber: params.orderName,
		invoicePayment: Number(params.codAmount) || 0,
		orderDetail: params.orderDetail || undefined,
		customerName: addr?.name ?? '',
		customerPhone: addr?.phone ?? '',
		deliveryAddress: addr ? [addr.address1, addr.city, addr.province].filter(Boolean).join(', ') : '',
		transactionNotes: params.note || undefined,
		cityName: addr?.city ?? '',
		invoiceDivision: 1,
		items: params.items || 1,
		orderType: 'Normal',
		pickupAddressCode: params.pickupAddressCode
	};

	const res = await fetch(POSTEX_CREATE_ORDER_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', token: apiKey },
		body: JSON.stringify(body)
	});

	const data = (await res.json()) as PostExCreateOrderResponse;

	if (!res.ok || !data.dist?.trackingNumber) {
		throw new Error(data.statusMessage || 'PostEx order creation failed');
	}

	return { trackingId: data.dist.trackingNumber };
}

// TODO: replace with real DEX API call once credentials/docs are available.
async function bookDex(apiKey: string, params: BookingParams): Promise<BookingResult> {
	return { trackingId: `DEX-STUB-${Date.now()}` };
}

export async function bookShipment(
	courier: CourierCode,
	apiKey: string,
	params: BookingParams
): Promise<BookingResult> {
	if (courier === 'postex') return bookPostEx(apiKey, params);
	return bookDex(apiKey, params);
}

export const COURIER_LABELS: Record<CourierCode, string> = {
	postex: 'PostEx',
	dex: 'DEX'
};

export function getCourierTrackingUrl(courier: CourierCode, trackingId: string): string | null {
	if (courier === 'postex') return `https://postex.pk/tracking?track_number=${encodeURIComponent(trackingId)}`;
	return null;
}

const POSTEX_CANCEL_ORDER_URL = 'https://api.postex.pk/services/integration/api/order/v1/cancel-order';

interface PostExCancelResponse {
	statusCode: string;
	statusMessage: string;
}

async function cancelPostEx(apiKey: string, trackingId: string): Promise<void> {
	const res = await fetch(POSTEX_CANCEL_ORDER_URL, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', token: apiKey },
		body: JSON.stringify({ trackingNumber: trackingId })
	});

	const data = (await res.json()) as PostExCancelResponse;
	if (!res.ok) throw new Error(data.statusMessage || 'PostEx order cancellation failed');
}

// TODO: replace with real DEX cancel API call once credentials/docs are available.
async function cancelDex(apiKey: string, trackingId: string): Promise<void> {
	return;
}

export async function cancelShipment(courier: CourierCode, apiKey: string, trackingId: string): Promise<void> {
	if (courier === 'postex') return cancelPostEx(apiKey, trackingId);
	return cancelDex(apiKey, trackingId);
}

const POSTEX_OPERATIONAL_CITIES_URL =
	'https://api.postex.pk/services/integration/api/order/v2/get-operational-city';

export interface OperationalCity {
	operationalCityName: string;
	countryName: string;
	isPickupCity: boolean;
	isDeliveryCity: boolean;
}

interface PostExOperationalCitiesResponse {
	statusCode: string;
	statusMessage: string;
	dist?: OperationalCity[];
}

const operationalCitiesCache = new Map<string, { at: number; cities: OperationalCity[] }>();
const CITIES_CACHE_MS = 60 * 60 * 1000;

export async function getPostExOperationalCities(apiKey: string): Promise<OperationalCity[]> {
	const cached = operationalCitiesCache.get(apiKey);
	if (cached && Date.now() - cached.at < CITIES_CACHE_MS) return cached.cities;

	const res = await fetch(`${POSTEX_OPERATIONAL_CITIES_URL}?operationalCityType=Delivery`, {
		headers: { token: apiKey }
	});
	const data = (await res.json()) as PostExOperationalCitiesResponse;
	if (!res.ok || !data.dist) throw new Error(data.statusMessage || 'Failed to fetch operational cities');

	operationalCitiesCache.set(apiKey, { at: Date.now(), cities: data.dist });
	return data.dist;
}

const POSTEX_BULK_TRACKING_URL = 'https://api.postex.pk/services/integration/api/order/v1/track-bulk-order';

interface PostExBulkTrackingResponse {
	statusCode: string;
	statusMessage: string;
	dist?: {
		trackingNumber: string;
		message: string;
		trackingResponse: { transactionStatus: string } | null;
	}[];
}

// PostEx's docs label this endpoint GET with a JSON body, which the Fetch API
// can't send on a GET request — using POST here, which is what their server
// actually accepts for every other body-bearing endpoint in the same API.
export async function getPostExBulkTrackingStatus(
	apiKey: string,
	trackingNumbers: string[]
): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	if (trackingNumbers.length === 0) return result;

	const res = await fetch(POSTEX_BULK_TRACKING_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', token: apiKey },
		body: JSON.stringify({ trackingNumber: trackingNumbers })
	});

	const data = (await res.json()) as PostExBulkTrackingResponse;
	if (!res.ok || !data.dist) throw new Error(data.statusMessage || 'Failed to fetch tracking status');

	for (const item of data.dist) {
		if (item.trackingResponse?.transactionStatus) {
			result.set(item.trackingNumber, item.trackingResponse.transactionStatus);
		}
	}
	return result;
}

const POSTEX_AIRWAY_BILL_URL = 'https://api.postex.pk/services/integration/api/order/v1/get-invoice';

// PostEx Airway Bill API (docs 3.10) — returns a PDF for up to 10 tracking numbers per call.
export async function getPostExAirwayBill(apiKey: string, trackingNumbers: string[]): Promise<Uint8Array> {
	if (trackingNumbers.length === 0 || trackingNumbers.length > 10) {
		throw new Error('Airway bill requires 1-10 tracking numbers per request');
	}
	const url = new URL(POSTEX_AIRWAY_BILL_URL);
	url.searchParams.set('trackingNumbers', trackingNumbers.join(','));

	const res = await fetch(url, { headers: { token: apiKey } });
	if (!res.ok) {
		let message = `Failed to fetch airway bill (HTTP ${res.status})`;
		try {
			const body = (await res.json()) as { statusMessage?: string; message?: string };
			message = body.statusMessage || body.message || message;
		} catch {
			/* non-JSON error body */
		}
		throw new Error(message);
	}
	return new Uint8Array(await res.arrayBuffer());
}

const POSTEX_LIST_ORDERS_URL = 'https://api.postex.pk/services/integration/api/order/v1/get-all-order';

export interface PostExOrderRow {
	trackingNumber: string;
	orderRefNumber: string;
	customerName: string;
	customerPhone: string;
	cityName: string;
	invoicePayment: number;
	orderDetail: string | null;
	transactionStatus: string | null;
	transactionDate: string;
	transactionNotes: string | null;
	items: number | null;
}

interface PostExListOrdersResponse {
	statusCode: string;
	statusMessage: string;
	dist?: PostExOrderRow[];
}

// Unlike the PDF docs (which show orderStatusID/fromDate/toDate as a JSON body),
// the live API is a real GET with query params named orderStatusId/startDate/endDate
// (confirmed against the actual server — it 400s on the documented names).
// orderStatusId: 0 lists every status (Unbooked, Booked, Delivered, etc — see PostEx docs 3.15).
export async function getPostExOrders(
	apiKey: string,
	startDate: string,
	endDate: string
): Promise<PostExOrderRow[]> {
	const url = new URL(POSTEX_LIST_ORDERS_URL);
	url.searchParams.set('orderStatusId', '0');
	url.searchParams.set('startDate', startDate);
	url.searchParams.set('endDate', endDate);

	const res = await fetch(url, { headers: { token: apiKey } });

	const data = (await res.json()) as PostExListOrdersResponse;
	if (!res.ok || !data.dist) throw new Error(data.statusMessage || 'Failed to fetch orders from PostEx');

	return data.dist;
}
