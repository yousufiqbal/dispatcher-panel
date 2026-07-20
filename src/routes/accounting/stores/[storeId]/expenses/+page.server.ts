import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { operatingExpenses, recurringExpenses } from '$lib/server/db/schema';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

function monthRange(month: string): { start: Date; end: Date } {
	const [y, m] = month.split('-').map(Number);
	const start = new Date(Date.UTC(y, m - 1, 1));
	const end = new Date(Date.UTC(y, m, 1));
	return { start, end };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const month = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
	const { start, end } = monthRange(month);

	const expenses = await db
		.select()
		.from(operatingExpenses)
		.where(
			and(
				eq(operatingExpenses.storeId, params.storeId),
				gte(operatingExpenses.expenseDate, start),
				lt(operatingExpenses.expenseDate, end)
			)
		)
		.orderBy(desc(operatingExpenses.expenseDate));

	const recurring = await db
		.select()
		.from(recurringExpenses)
		.where(eq(recurringExpenses.storeId, params.storeId))
		.orderBy(desc(recurringExpenses.createdAt));

	return { month, expenses, recurring };
};

export const actions: Actions = {
	addExpense: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const category = (fd.get('category') as string)?.trim();
		const description = (fd.get('description') as string)?.trim() || null;
		const amount = fd.get('amount') as string;
		const expenseDate = fd.get('expenseDate') as string;

		if (!category || !amount || !expenseDate || isNaN(parseFloat(amount))) {
			return fail(400, { error: 'Category, amount, and date are required' });
		}
		if (!locals.session) return fail(401);

		const [row] = await db
			.insert(operatingExpenses)
			.values({
				storeId: params.storeId,
				category,
				description,
				amount,
				expenseDate: new Date(expenseDate),
				createdBy: locals.session.userId
			})
			.returning({ id: operatingExpenses.id });

		await logAudit(locals.session.userId, 'accounting', 'expense.create', {
			targetType: 'operatingExpense',
			targetId: row.id,
			storeId: params.storeId,
			metadata: { category, amount, expenseDate }
		});

		return { success: true };
	},

	deleteExpense: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		if (!id) return fail(400);
		if (!locals.session) return fail(401);

		await db.delete(operatingExpenses).where(and(eq(operatingExpenses.id, id), eq(operatingExpenses.storeId, params.storeId)));

		await logAudit(locals.session.userId, 'accounting', 'expense.delete', {
			targetType: 'operatingExpense',
			targetId: id,
			storeId: params.storeId
		});

		return { success: true };
	},

	addRecurring: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const category = (fd.get('category') as string)?.trim();
		const description = (fd.get('description') as string)?.trim() || null;
		const amount = fd.get('amount') as string;
		const dayOfMonth = parseInt(fd.get('dayOfMonth') as string, 10);

		if (!category || !amount || isNaN(parseFloat(amount)) || !dayOfMonth || dayOfMonth < 1 || dayOfMonth > 28) {
			return fail(400, { error: 'Category, amount, and a day of month (1-28) are required' });
		}
		if (!locals.session) return fail(401);

		const [row] = await db
			.insert(recurringExpenses)
			.values({ storeId: params.storeId, category, description, amount, dayOfMonth, createdBy: locals.session.userId })
			.returning({ id: recurringExpenses.id });

		await logAudit(locals.session.userId, 'accounting', 'recurringExpense.create', {
			targetType: 'recurringExpense',
			targetId: row.id,
			storeId: params.storeId,
			metadata: { category, amount, dayOfMonth }
		});

		return { success: true };
	},

	toggleRecurring: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		const isActive = fd.get('isActive') === 'true';
		if (!id) return fail(400);
		if (!locals.session) return fail(401);

		await db
			.update(recurringExpenses)
			.set({ isActive, updatedAt: new Date() })
			.where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.storeId, params.storeId)));

		await logAudit(locals.session.userId, 'accounting', 'recurringExpense.toggle', {
			targetType: 'recurringExpense',
			targetId: id,
			storeId: params.storeId,
			metadata: { isActive }
		});

		return { success: true };
	},

	deleteRecurring: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		if (!id) return fail(400);
		if (!locals.session) return fail(401);

		await db.delete(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.storeId, params.storeId)));

		await logAudit(locals.session.userId, 'accounting', 'recurringExpense.delete', {
			targetType: 'recurringExpense',
			targetId: id,
			storeId: params.storeId
		});

		return { success: true };
	}
};
