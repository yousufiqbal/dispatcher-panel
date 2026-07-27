import { error } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';

function verifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
	const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
	const a = Buffer.from(computed);
	const b = Buffer.from(hmacHeader);
	return a.length === b.length && timingSafeEqual(a, b);
}

// Shared by every Shopify webhook route — verifies the HMAC signature and
// resolves which store it belongs to.
export async function verifyShopifyWebhook(request: Request, rawBody: string) {
	const shopDomain = request.headers.get('x-shopify-shop-domain');
	const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
	if (!shopDomain || !hmacHeader) throw error(401, 'Missing Shopify headers');

	const store = await db.query.stores.findFirst({ where: eq(stores.shopifyDomain, shopDomain) });
	if (!store || !store.oauthClientSecret) throw error(401, 'Unknown store or no webhook secret configured');

	const secret = decrypt(store.oauthClientSecret);
	if (!verifyHmac(rawBody, hmacHeader, secret)) throw error(401, 'Invalid HMAC');

	return store;
}
