import { isKnownPakistanCity } from './pakistan-cities';
import type { OrderNode } from './shopify/orders';

const JUNK_NAMES = new Set(['test', 'na', 'nan', 'unknown', 'guest', 'asdf', 'none', 'abc', 'customer', 'xx', 'xxx']);

function isJunkWord(word: string): boolean {
	const w = word.trim().toLowerCase();
	if (!w) return true;
	if (JUNK_NAMES.has(w)) return true;
	if (/^\d+$/.test(w)) return true; // all digits
	if (/^(.)\1*$/.test(w)) return true; // repeated single char, e.g. "aaaa"
	return false;
}

function isValidPakPhone(raw: string): boolean {
	const digits = raw.replace(/\D/g, '');
	if (!digits) return false;
	let national = digits;
	if (digits.startsWith('0')) national = digits.slice(1);
	else if (digits.startsWith('92')) national = digits.slice(2);
	return /^3\d{9}$/.test(national);
}

// Flags orders whose shipping info looks wrong using simple, deterministic checks —
// no external API calls, so this is safe to run on demand over many orders.
export function checkAddress(order: Pick<OrderNode, 'shippingAddress' | 'customer' | 'phone'>): string[] {
	const reasons: string[] = [];
	const addr = order.shippingAddress;

	if (!addr) {
		return ['No shipping address'];
	}

	const address1 = addr.address1?.trim() ?? '';
	if (address1.length < 6) reasons.push('Street address is missing or too short');

	const city = addr.city?.trim() ?? '';
	if (!city) reasons.push('City is missing');
	else if (!isKnownPakistanCity(city)) reasons.push(`City "${city}" not recognized`);

	const name = addr.name?.trim() ?? '';
	const nameWords = name.split(/\s+/).filter(Boolean);
	if (nameWords.length === 0) reasons.push('Customer name is missing');
	else if (nameWords.length === 1) reasons.push('Customer name looks incomplete');
	else if (nameWords.every(isJunkWord)) reasons.push('Customer name looks like a placeholder');

	const phone = addr.phone ?? order.customer?.phone ?? order.phone ?? '';
	if (!phone) reasons.push('Phone number is missing');
	else if (!isValidPakPhone(phone)) reasons.push('Phone number is not a valid Pakistani mobile number');

	return reasons;
}
