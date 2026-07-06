import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { StoreSchema } from '$lib/schemas/store';
import { encrypt, decrypt } from '$lib/server/crypto';
import { fileToDataUrl } from '$lib/server/image';
import { getShopifyClient, shopifyRequest, invalidateClient } from '$lib/server/shopify/client';
import { registerOrderCreateWebhook } from '$lib/server/shopify/webhooks';
import { logAudit } from '$lib/server/audit';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ params }) => {
	const store = await db.query.stores.findFirst({ where: eq(stores.id, params.id) });
	if (!store) throw error(404, 'Store not found');
	return { store: { ...store, apiAccessToken: '', oauthClientSecret: '' } }; // never send secrets to client
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const raw = {
			name: fd.get('name') as string,
			shopifyDomain: fd.get('shopifyDomain') as string,
			apiAccessToken: (fd.get('apiAccessToken') as string) ?? '',
			oauthClientId: (fd.get('oauthClientId') as string) ?? '',
			oauthClientSecret: (fd.get('oauthClientSecret') as string) ?? '',
			oauthRedirectUri: (fd.get('oauthRedirectUri') as string) ?? ''
		};

		const existing = await db.query.stores.findFirst({ where: eq(stores.id, params.id) });
		if (!existing) throw error(404, 'Store not found');

		// If token/secret blank, keep existing
		const tokenToUse = raw.apiAccessToken.trim() || decrypt(existing.apiAccessToken);
		const clientSecretToUse =
			raw.oauthClientSecret.trim() ||
			(existing.oauthClientSecret ? decrypt(existing.oauthClientSecret) : '');
		const dataToValidate = { ...raw, apiAccessToken: tokenToUse };

		const result = safeParse(StoreSchema, dataToValidate);
		if (!result.success) {
			return fail(400, { errors: result.issues.map((i) => i.message), values: raw });
		}

		invalidateClient(existing.shopifyDomain);

		const uploadedIcon = await fileToDataUrl(fd.get('icon') as File | null);

		await db.update(stores).set({
			name: result.output.name,
			iconUrl: uploadedIcon ?? existing.iconUrl,
			shopifyDomain: result.output.shopifyDomain,
			apiAccessToken: encrypt(tokenToUse),
			oauthClientId: raw.oauthClientId.trim() || null,
			oauthClientSecret: clientSecretToUse ? encrypt(clientSecretToUse) : null,
			oauthRedirectUri: raw.oauthRedirectUri.trim() || null,
			updatedAt: new Date()
		}).where(eq(stores.id, params.id));

		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'store.update', { targetType: 'store', targetId: params.id });
		}

		if (env.PUBLIC_APP_URL) {
			try {
				const client = getShopifyClient({
					shopifyDomain: result.output.shopifyDomain,
					apiAccessToken: tokenToUse
				});
				await registerOrderCreateWebhook(client, `${env.PUBLIC_APP_URL}/api/webhooks/orders-create`);
			} catch (err) {
				console.error('[webhook registration failed]', err);
			}
		}

		throw redirect(303, `/admin/stores/${params.id}`);
	},

	delete: async ({ params, locals }) => {
		await db.delete(stores).where(eq(stores.id, params.id));
		if (locals.session) {
			await logAudit(locals.session.userId, 'admin', 'store.delete', { targetType: 'store', targetId: params.id });
		}
		throw redirect(303, '/admin/stores');
	},

	toggleActive: async ({ params, locals }) => {
		const store = await db.query.stores.findFirst({ where: eq(stores.id, params.id) });
		if (!store) throw error(404);
		await db.update(stores).set({ isActive: !store.isActive, updatedAt: new Date() }).where(eq(stores.id, params.id));
		return { success: true };
	}
};
