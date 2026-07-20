<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatCurrency } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function changeMonth(delta: number) {
		const [y, m] = data.month.split('-').map(Number);
		const d = new Date(Date.UTC(y, m - 1 + delta, 1));
		const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		goto(`?month=${next}`, { keepFocus: true });
	}
</script>

<svelte:head><title>Income Statement — {data.storeName}</title></svelte:head>

<div class="p-3 sm:p-6 max-w-2xl mx-auto">
	<div class="card p-5 mb-5 flex items-center justify-between gap-3">
		<Button variant="ghost" size="icon" onclick={() => changeMonth(-1)}>‹</Button>
		<div class="text-sm font-semibold text-foreground">
			{new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
		</div>
		<Button variant="ghost" size="icon" onclick={() => changeMonth(1)}>›</Button>
	</div>

	<div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 mb-5">
		Only Operating Expenses are wired up so far. Net Sales, COGS, and Damages/shrinkage will appear here once Purchases and Damages are built.
	</div>

	<div class="card overflow-hidden">
		<div class="px-5 py-3 border-b border-border">
			<h2 class="text-sm font-semibold text-foreground">Operating Expenses</h2>
		</div>
		{#if data.expensesByCategory.length === 0}
			<div class="px-5 py-8 text-center text-sm text-muted-foreground">No expenses recorded this month.</div>
		{:else}
			<div class="divide-y divide-border">
				{#each data.expensesByCategory as row}
					<div class="flex items-center justify-between px-5 py-2.5 text-sm">
						<span class="text-foreground">{row.category}</span>
						<span class="tabular-nums text-foreground">{formatCurrency(String(row.amount), 'PKR')}</span>
					</div>
				{/each}
			</div>
		{/if}
		<div class="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
			<span class="text-sm font-semibold text-foreground">Total Operating Expenses</span>
			<span class="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(String(data.totalExpenses), 'PKR')}</span>
		</div>
	</div>

	<div class="card overflow-hidden mt-5">
		<div class="flex items-center justify-between px-5 py-4">
			<span class="text-sm font-bold text-foreground">Net Income (expenses only)</span>
			<span class="text-sm font-bold tabular-nums {data.totalExpenses > 0 ? 'text-red-600' : 'text-foreground'}">
				-{formatCurrency(String(data.totalExpenses), 'PKR')}
			</span>
		</div>
	</div>
</div>
