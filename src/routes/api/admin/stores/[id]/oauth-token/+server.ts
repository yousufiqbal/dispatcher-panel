import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.session || locals.session.role !== 'admin') throw error(401, 'Unauthorized');

	const { code } = await request.json();
	if (!code || typeof code !== 'string') throw error(400, 'Missing code');

	const store = await db.query.stores.findFirst({ where: eq(stores.id, params.id) });
	if (!store) throw error(404, 'Store not found');
	if (!store.oauthClientId || !store.oauthClientSecret) {
		throw error(400, 'Store has no OAuth client configured');
	}

	const res = await fetch(`https://${store.shopifyDomain}/admin/oauth/access_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: store.oauthClientId,
			client_secret: decrypt(store.oauthClientSecret),
			code
		})
	});

	if (!res.ok) {
		throw error(400, 'Shopify rejected the code exchange — code may be expired or already used');
	}

	const data = (await res.json()) as { access_token: string; scope: string };
	return json({ accessToken: data.access_token, scope: data.scope });
};
