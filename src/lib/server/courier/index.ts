export type CourierCode = 'postex' | 'dex';

export interface BookingParams {
	orderName: string;
	weight: string;
	codAmount: string;
	fragile: boolean;
	note: string;
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

async function bookPostEx(apiKey: string, params: BookingParams): Promise<BookingResult> {
	const addr = params.shippingAddress;

	const body = {
		orderRefNumber: params.orderName,
		invoicePayment: Number(params.codAmount) || 0,
		orderDetail: params.note || undefined,
		customerName: addr?.name ?? '',
		customerPhone: addr?.phone ?? '',
		deliveryAddress: addr ? [addr.address1, addr.city, addr.province].filter(Boolean).join(', ') : '',
		transactionNotes: params.note || undefined,
		cityName: addr?.city ?? '',
		invoiceDivision: 1,
		items: 1,
		orderType: 'Normal'
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
