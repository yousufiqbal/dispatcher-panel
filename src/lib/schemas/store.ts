import * as v from 'valibot';

export const StoreSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Name required'), v.maxLength(100)),
	shopifyDomain: v.pipe(
		v.string(),
		v.regex(/^[a-z0-9-]+\.myshopify\.com$/, 'Must be a valid myshopify.com domain')
	),
	apiAccessToken: v.pipe(
		v.string(),
		v.minLength(1, 'Access token required')
	),
	oauthClientId: v.optional(v.string()),
	oauthClientSecret: v.optional(v.string()),
	oauthRedirectUri: v.optional(v.string())
});

export type StoreInput = v.InferOutput<typeof StoreSchema>;
