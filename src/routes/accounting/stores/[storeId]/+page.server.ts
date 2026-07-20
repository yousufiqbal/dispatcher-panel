import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { operatingExpenses, damages } from '$lib/server/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

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
		.select({ category: operatingExpenses.category, amount: operatingExpenses.amount })
		.from(operatingExpenses)
		.where(
			and(
				eq(operatingExpenses.storeId, params.storeId),
				gte(operatingExpenses.expenseDate, start),
				lt(operatingExpenses.expenseDate, end)
			)
		);

	const byCategory = new Map<string, number>();
	let totalExpenses = 0;
	for (const e of expenses) {
		const amt = parseFloat(e.amount);
		totalExpenses += amt;
		byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amt);
	}

	const damageRows = await db
		.select({ totalCost: damages.totalCost })
		.from(damages)
		.where(
			and(
				eq(damages.storeId, params.storeId),
				gte(damages.damageDate, start),
				lt(damages.damageDate, end)
			)
		);
	const totalDamages = damageRows.reduce((sum, d) => sum + parseFloat(d.totalCost), 0);

	return {
		month,
		expensesByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
		totalExpenses,
		totalDamages
	};
};
