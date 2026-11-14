import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dispatchers, sessions, auditLog } from '$lib/server/db/schema';
import { eq, and, asc, desc, max } from 'drizzle-orm';
import { safeParse } from 'valibot';
import { hash } from 'argon2';
import { DispatcherCreateSchema, DispatcherUpdateSchema } from '$lib/schemas/dispatcher';
import { requireOwner } from '$lib/server/owner';
import { isEmailTaken } from '$lib/server/email-availability';
import { revokeTrustedDevices } from '$lib/server/trusted-device';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals }) => {
	const session = requireOwner(locals.session);

	const [people, lastSeen] = await Promise.all([
		db
			.select({
				id: dispatchers.id,
				name: dispatchers.name,
				email: dispatchers.email,
				isActive: dispatchers.isActive,
				isOwner: dispatchers.isOwner,
				totpEnabled: dispatchers.totpEnabled,
				createdAt: dispatchers.createdAt
			})
			.from(dispatchers)
			.orderBy(desc(dispatchers.isOwner), desc(dispatchers.isActive), asc(dispatchers.name)),
		db.select({ actorId: auditLog.actorId, at: max(auditLog.createdAt) }).from(auditLog).groupBy(auditLog.actorId)
	]);

	const lastById = new Map(lastSeen.map((r) => [r.actorId, r.at]));
	return {
		meId: session.userId,
		people: people.map((p) => ({ ...p, lastActiveAt: lastById.get(p.id) ?? null }))
	};
};

// Any session/trusted device of `id` stops working immediately — used when an
// account is disabled or its 2FA is reset.
async function signOutEverywhere(id: string) {
	await revokeTrustedDevices(id);
	await db.delete(sessions).where(and(eq(sessions.userId, id), eq(sessions.role, 'dispatcher')));
}

async function findPerson(id: string) {
	return db.query.dispatchers.findFirst({ where: eq(dispatchers.id, id) });
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const session = requireOwner(locals.session);
		const fd = await request.formData();
		const raw = {
			name: (fd.get('name') ?? '').toString().trim(),
			email: (fd.get('email') ?? '').toString().trim(),
			password: (fd.get('password') ?? '').toString(),
			storeIds: []
		};
		const result = safeParse(DispatcherCreateSchema, raw);
		if (!result.success) return fail(400, { error: result.issues[0]?.message ?? 'Invalid input' });
		if (await isEmailTaken(result.output.email)) return fail(400, { error: 'That email is already in use' });

		const [created] = await db
			.insert(dispatchers)
			.values({ name: result.output.name, email: result.output.email, passwordHash: await hash(result.output.password) })
			.returning({ id: dispatchers.id });

		await logAudit(session.userId, 'dispatcher', 'team.create', {
			targetType: 'dispatcher',
			targetId: created.id,
			metadata: { name: result.output.name, email: result.output.email }
		});
		return { done: 'created' };
	},

	update: async ({ request, locals }) => {
		const session = requireOwner(locals.session);
		const fd = await request.formData();
		const id = (fd.get('id') ?? '').toString();
		const person = await findPerson(id);
		if (!person) return fail(404, { error: 'Person not found' });

		const raw = {
			name: (fd.get('name') ?? '').toString().trim(),
			email: (fd.get('email') ?? '').toString().trim(),
			password: (fd.get('password') ?? '').toString() || undefined,
			storeIds: [],
			isActive: person.isActive
		};
		const result = safeParse(DispatcherUpdateSchema, raw);
		if (!result.success) return fail(400, { error: result.issues[0]?.message ?? 'Invalid input' });
		if (await isEmailTaken(result.output.email, id)) return fail(400, { error: 'That email is already in use' });

		await db
			.update(dispatchers)
			.set({
				name: result.output.name,
				email: result.output.email,
				...(result.output.password ? { passwordHash: await hash(result.output.password) } : {}),
				updatedAt: new Date()
			})
			.where(eq(dispatchers.id, id));

		await logAudit(session.userId, 'dispatcher', 'team.update', {
			targetType: 'dispatcher',
			targetId: id,
			metadata: { name: result.output.name, passwordChanged: !!result.output.password }
		});
		return { done: 'updated' };
	},

	// Disabling keeps the account (and its history) but signs it out and blocks
	// sign-in. The owner can't disable themselves — the panel would be locked.
	setActive: async ({ request, locals }) => {
		const session = requireOwner(locals.session);
		const fd = await request.formData();
		const id = (fd.get('id') ?? '').toString();
		const active = fd.get('active') === 'true';
		const person = await findPerson(id);
		if (!person) return fail(404, { error: 'Person not found' });
		if (person.isOwner) return fail(400, { error: "The owner account can't be disabled" });

		await db.update(dispatchers).set({ isActive: active, updatedAt: new Date() }).where(eq(dispatchers.id, id));
		if (!active) await signOutEverywhere(id);

		await logAudit(session.userId, 'dispatcher', active ? 'team.enable' : 'team.disable', {
			targetType: 'dispatcher',
			targetId: id,
			metadata: { name: person.name }
		});
		return { done: active ? 'enabled' : 'disabled' };
	},

	// Lost or replaced phone: clears the authenticator so they enrol again on
	// next sign-in, and signs them out everywhere so the old phone is useless.
	resetTotp: async ({ request, locals }) => {
		const session = requireOwner(locals.session);
		const fd = await request.formData();
		const id = (fd.get('id') ?? '').toString();
		const person = await findPerson(id);
		if (!person) return fail(404, { error: 'Person not found' });
		if (id === session.userId) return fail(400, { error: "You can't reset your own 2FA from here" });

		await db
			.update(dispatchers)
			.set({ totpSecret: null, totpEnabled: false, updatedAt: new Date() })
			.where(eq(dispatchers.id, id));
		await signOutEverywhere(id);

		await logAudit(session.userId, 'dispatcher', 'dispatcher.totpReset', {
			targetType: 'dispatcher',
			targetId: id,
			metadata: { name: person.name, email: person.email }
		});
		return { done: 'totpReset' };
	}
};
