import * as v from 'valibot';

export const LoginSchema = v.object({
	email: v.pipe(v.string(), v.email('Invalid email')),
	password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
});

export const TotpSchema = v.object({
	code: v.pipe(v.string(), v.length(6, 'Code must be 6 digits'), v.regex(/^\d+$/, 'Digits only'))
});

export const RegisterAdminSchema = v.object({
	email: v.pipe(v.string(), v.email('Invalid email')),
	password: v.pipe(v.string(), v.minLength(10, 'Password must be at least 10 characters'))
});

export type LoginInput = v.InferOutput<typeof LoginSchema>;
export type TotpInput = v.InferOutput<typeof TotpSchema>;
export type RegisterAdminInput = v.InferOutput<typeof RegisterAdminSchema>;
