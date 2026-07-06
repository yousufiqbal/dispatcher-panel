import * as v from 'valibot';

export const CourierCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters')),
	provider: v.picklist(['postex', 'dex'], 'Provider must be PostEx or DEX'),
	apiKey: v.optional(v.string()),
	enabled: v.boolean(),
	defaultWeight: v.optional(v.string()),
	defaultFragile: v.boolean(),
	defaultNote: v.optional(v.string()),
	storeIds: v.array(v.string())
});

export type CourierCreateInput = v.InferOutput<typeof CourierCreateSchema>;
