import { text, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';
import { notifyStoreDispatchers } from '$lib/server/push/send';

function verifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
	const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
	const a = Buffer.from(computed);
	const b = Buffer.from(hmacHeader);
	return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
	const shopDomain = request.headers.get('x-shopify-shop-domain');
	const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
	if (!shopDomain || !hmacHeader) throw error(401, 'Missing Shopify headers');

	const rawBody = await request.text();

	const store = await db.query.stores.findFirst({ where: eq(stores.shopifyDomain, shopDomain) });
	if (!store || !store.oauthClientSecret) throw error(401, 'Unknown store or no webhook secret configured');

	const secret = decrypt(store.oauthClientSecret);
	if (!verifyHmac(rawBody, hmacHeader, secret)) throw error(401, 'Invalid HMAC');

	const order = JSON.parse(rawBody) as {
		name: string;
		customer?: { first_name?: string; last_name?: string };
		total_price?: string;
		currency?: string;
	};

	const customerName = order.customer
		? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(' ') || 'Guest'
		: 'Guest';

	await notifyStoreDispatchers(store.id, {
		title: `New order ${order.name}`,
		body: `${customerName} — ${order.total_price ?? ''} ${order.currency ?? ''}`.trim(),
		tag: order.name,
		url: `/dashboard/stores/${store.id}/orders`
	});

	return text('ok');
};
