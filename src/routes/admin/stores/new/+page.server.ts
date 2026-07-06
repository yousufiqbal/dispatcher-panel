import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { safeParse } from 'valibot';
import { StoreSchema } from '$lib/schemas/store';
import { encrypt } from '$lib/server/crypto';
import { fileToDataUrl } from '$lib/server/image';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { registerOrderCreateWebhook } from '$lib/server/shopify/webhooks';
import { logAudit } from '$lib/server/audit';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => ({ });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const fd = await request.formData();
		const raw = {
			name: fd.get('name') as string,
			shopifyDomain: fd.get('shopifyDomain') as string,
			apiAccessToken: fd.get('apiAccessToken') as string,
			oauthClientId: (fd.get('oauthClientId') as string) ?? '',
			oauthClientSecret: (fd.get('oauthClientSecret') as string) ?? '',
			oauthRedirectUri: (fd.get('oauthRedirectUri') as string) ?? ''
		};

		const result = safeParse(StoreSchema, raw);
		if (!result.success) {
			return fail(400, { errors: result.issues.map((i) => i.message), values: raw });
		}

		// Test connection
		try {
			const testClient = getShopifyClient({
				shopifyDomain: result.output.shopifyDomain,
				apiAccessToken: result.output.apiAccessToken
			});
			await shopifyRequest(testClient, `query { shop { name } }`);
		} catch {
			return fail(400, { errors: ['Could not connect to Shopify — check domain and token'], values: raw });
		}

		const iconUrl = await fileToDataUrl(fd.get('icon') as File | null);

		const encryptedToken = encrypt(result.output.apiAccessToken);
		await db.insert(stores).values({
			name: result.output.name,
			iconUrl,
			shopifyDomain: result.output.shopifyDomain,
			apiAccessToken: encryptedToken,
			oauthClientId: raw.oauthClientId.trim() || null,
			oauthClientSecret: raw.oauthClientSecret.trim() ? encrypt(raw.oauthClientSecret.trim()) : null,
			oauthRedirectUri: raw.oauthRedirectUri.trim() || null
		});

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'store.create', {
				targetType: 'store',
				metadata: { name: result.output.name }
			});
		}

		if (env.PUBLIC_APP_URL) {
			try {
				const client = getShopifyClient({
					shopifyDomain: result.output.shopifyDomain,
					apiAccessToken: result.output.apiAccessToken
				});
				await registerOrderCreateWebhook(client, `${env.PUBLIC_APP_URL}/api/webhooks/orders-create`);
			} catch (err) {
				console.error('[webhook registration failed]', err);
			}
		}

		throw redirect(303, '/admin/stores');
	}
};
