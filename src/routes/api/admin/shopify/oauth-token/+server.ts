import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.session || locals.session.role !== 'admin') throw error(401, 'Unauthorized');

	const { shopifyDomain, clientId, clientSecret, code } = await request.json();
	if (!shopifyDomain || !clientId || !clientSecret || !code) {
		throw error(400, 'Missing shopifyDomain, clientId, clientSecret, or code');
	}

	const res = await fetch(`https://${shopifyDomain}/admin/oauth/access_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
	});

	if (!res.ok) {
		throw error(400, 'Shopify rejected the code exchange — code may be expired or already used');
	}

	const data = (await res.json()) as { access_token: string; scope: string };
	return json({ accessToken: data.access_token, scope: data.scope });
};
