import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { recurringExpenses, operatingExpenses } from '$lib/server/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { logAudit } from '$lib/server/audit';

// Runs daily. For each active recurring expense whose dayOfMonth has been
// reached this month and hasn't already been posted for this month, inserts
// one operatingExpenses row and stamps lastMaterializedMonth so it isn't
// posted twice if the cron runs more than once on/after that day.
export const GET: RequestHandler = async ({ url, request }) => {
	const secret = url.searchParams.get('secret') ?? request.headers.get('x-cron-secret');
	if (!env.CRON_SECRET || secret !== env.CRON_SECRET) throw error(401, 'Unauthorized');

	const now = new Date();
	const currentMonth = now.toISOString().slice(0, 7);
	const todayOfMonth = now.getUTCDate();

	const due = await db
		.select()
		.from(recurringExpenses)
		.where(and(eq(recurringExpenses.isActive, true), lte(recurringExpenses.dayOfMonth, todayOfMonth)));

	let posted = 0;

	for (const r of due) {
		if (r.lastMaterializedMonth === currentMonth) continue;

		const expenseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), r.dayOfMonth));

		const [row] = await db
			.insert(operatingExpenses)
			.values({
				storeId: r.storeId,
				category: r.category,
				description: r.description,
				amount: r.amount,
				expenseDate,
				recurringExpenseId: r.id,
				createdBy: r.createdBy
			})
			.returning({ id: operatingExpenses.id });

		await db
			.update(recurringExpenses)
			.set({ lastMaterializedMonth: currentMonth, updatedAt: new Date() })
			.where(eq(recurringExpenses.id, r.id));

		await logAudit(r.createdBy, 'accounting', 'recurringExpense.materialize', {
			targetType: 'operatingExpense',
			targetId: row.id,
			storeId: r.storeId,
			metadata: { recurringExpenseId: r.id, month: currentMonth, amount: r.amount }
		});

		posted++;
	}

	return json({ checked: due.length, posted });
};
