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

// TODO: replace with real PostEx API call once credentials/docs are available.
// Expected: POST to PostEx's order-booking endpoint with apiKey as auth header,
// mapping weight/codAmount/fragile/shippingAddress to their request schema.
async function bookPostEx(apiKey: string, params: BookingParams): Promise<BookingResult> {
	return { trackingId: `POSTEX-STUB-${Date.now()}` };
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
