import * as v from 'valibot';

export const StoreSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Name required'), v.maxLength(100)),
	nickname: v.pipe(v.string(), v.minLength(1, 'Nickname required'), v.maxLength(30)),
	shopifyDomain: v.pipe(
		v.string(),
		v.regex(/^[a-z0-9-]+\.myshopify\.com$/, 'Must be a valid myshopify.com domain')
	),
	apiAccessToken: v.pipe(
		v.string(),
		v.minLength(1, 'Access token required')
	)
});

export type StoreInput = v.InferOutput<typeof StoreSchema>;
