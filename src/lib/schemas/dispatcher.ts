import * as v from 'valibot';

export const DispatcherCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters')),
	email: v.pipe(v.string(), v.email('Invalid email')),
	password: v.pipe(v.string(), v.minLength(10, 'Password must be at least 10 characters')),
	storeIds: v.array(v.string())
});

export const DispatcherUpdateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2)),
	email: v.pipe(v.string(), v.email()),
	password: v.optional(v.pipe(v.string(), v.minLength(10))),
	storeIds: v.array(v.string()),
	isActive: v.boolean()
});

export type DispatcherCreateInput = v.InferOutput<typeof DispatcherCreateSchema>;
export type DispatcherUpdateInput = v.InferOutput<typeof DispatcherUpdateSchema>;
