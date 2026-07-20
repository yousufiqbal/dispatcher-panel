import * as v from 'valibot';

export const AccountantCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters')),
	email: v.pipe(v.string(), v.email('Invalid email')),
	password: v.pipe(v.string(), v.minLength(10, 'Password must be at least 10 characters')),
	storeIds: v.array(v.string())
});

export const AccountantUpdateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2)),
	email: v.pipe(v.string(), v.email()),
	password: v.optional(v.pipe(v.string(), v.minLength(10))),
	storeIds: v.array(v.string()),
	isActive: v.boolean()
});

export type AccountantCreateInput = v.InferOutput<typeof AccountantCreateSchema>;
export type AccountantUpdateInput = v.InferOutput<typeof AccountantUpdateSchema>;
