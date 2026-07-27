import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { operatingExpenses, damages, monthlyCloses, variantCosts } from '$lib/server/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedAccountingStore } from '$lib/server/store-access';
import { fetchMonthlySales } from '$lib/server/shopify/restock';
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
		.select({ category: operatingExpenses.category, amount: operatingExpenses.amount })
		.from(operatingExpenses)
		.where(and(eq(operatingExpenses.storeId, params.storeId), gte(operatingExpenses.expenseDate, start), lt(operatingExpenses.expenseDate, end)));

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
		.where(and(eq(damages.storeId, params.storeId), gte(damages.damageDate, start), lt(damages.damageDate, end)));
	const totalDamages = damageRows.reduce((sum, d) => sum + parseFloat(d.totalCost), 0);

	const close = await db.query.monthlyCloses.findFirst({
		where: and(eq(monthlyCloses.storeId, params.storeId), eq(monthlyCloses.month, month))
	});

	const netSales = close ? parseFloat(close.netSales) : 0;
	const cogs = close ? parseFloat(close.cogs) : 0;
	const grossProfit = netSales - cogs;
	const netIncome = grossProfit - totalDamages - totalExpenses;

	return {
		month,
		closed: !!close,
		closedAt: close?.closedAt ?? null,
		unitsSold: close?.unitsSold ?? 0,
		netSales,
		cogs,
		grossProfit,
		expensesByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
		totalExpenses,
		totalDamages,
		netIncome
	};
};

export const actions: Actions = {
	// Manually pulls that month's orders from Shopify and records net sales +
	// COGS (using each SKU's CURRENT average cost, not a historical snapshot —
	// simple on purpose, since this only runs once a month after the fact).
	// Safe to re-run — overwrites the same month's row.
	closeMonth: async ({ request, params, locals }) => {
		if (!locals.session) return fail(401);

		const fd = await request.formData();
		const month = fd.get('month') as string;
		if (!month) return fail(400, { error: 'Missing month' });

		const { start, end } = monthRange(month);

		const store = await getAuthorizedAccountingStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const sales = await fetchMonthlySales(client, start, end);

		let cogs = 0;
		for (const [variantId, qty] of sales.qtyByVariant) {
			const cost = await db.query.variantCosts.findFirst({
				where: and(eq(variantCosts.storeId, params.storeId), eq(variantCosts.variantId, variantId))
			});
			if (cost) cogs += qty * parseFloat(cost.avgCost);
		}

		await db
			.insert(monthlyCloses)
			.values({
				storeId: params.storeId,
				month,
				netSales: sales.netSales.toFixed(2),
				cogs: cogs.toFixed(2),
				unitsSold: sales.unitsSold,
				closedBy: locals.session.userId
			})
			.onConflictDoUpdate({
				target: [monthlyCloses.storeId, monthlyCloses.month],
				set: {
					netSales: sales.netSales.toFixed(2),
					cogs: cogs.toFixed(2),
					unitsSold: sales.unitsSold,
					closedBy: locals.session.userId,
					closedAt: new Date()
				}
			});

		await logAudit(locals.session.userId, 'accounting', 'month.close', {
			targetType: 'monthlyClose',
			targetId: month,
			storeId: params.storeId,
			metadata: { netSales: sales.netSales, cogs, unitsSold: sales.unitsSold }
		});

		return { success: true };
	}
};
