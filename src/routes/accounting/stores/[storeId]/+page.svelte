<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { formatCurrency, formatDateShort } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let closing = $state(false);

	function changeMonth(delta: number) {
		const [y, m] = data.month.split('-').map(Number);
		const d = new Date(Date.UTC(y, m - 1 + delta, 1));
		const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		goto(`?month=${next}`, { keepFocus: true });
	}

	function money(n: number) {
		return formatCurrency(String(n), 'PKR');
	}
</script>

<svelte:head><title>Income Statement — {data.storeName}</title></svelte:head>

<div class="p-3 sm:p-6 max-w-2xl mx-auto">
	<div class="card p-5 mb-5 flex items-center justify-between gap-3">
		<Button variant="ghost" size="icon" onclick={() => changeMonth(-1)}><ChevronLeftIcon class="size-5" /></Button>
		<div class="text-sm font-semibold text-foreground">
			{new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
		</div>
		<Button variant="ghost" size="icon" onclick={() => changeMonth(1)}><ChevronRightIcon class="size-5" /></Button>
	</div>

	{#if !data.closed}
		<div class="card border-dashed p-6 text-center mb-5">
			<p class="text-sm text-muted-foreground mb-4">Sales for this month haven't been recorded yet.</p>
			<form
				method="POST"
				action="?/closeMonth"
				use:enhance={() => {
					closing = true;
					return async ({ update }) => { await update(); closing = false; };
				}}
			>
				<input type="hidden" name="month" value={data.month} />
				<Button type="submit" disabled={closing}>
					{#if closing}<Loader2Icon class="size-4 animate-spin" />{:else}<RefreshCwIcon class="size-4" />{/if}
					{closing ? 'Fetching from Shopify…' : 'Record Sales for this Month'}
				</Button>
			</form>
		</div>
	{:else}
		<div class="flex items-center justify-between px-1 mb-3">
			<p class="text-xs text-muted-foreground">
				Sales recorded {formatDateShort(data.closedAt!.toString())} · {data.unitsSold} unit{data.unitsSold !== 1 ? 's' : ''} sold
			</p>
			<form
				method="POST"
				action="?/closeMonth"
				use:enhance={() => {
					closing = true;
					return async ({ update }) => { await update(); closing = false; };
				}}
			>
				<input type="hidden" name="month" value={data.month} />
				<Button type="submit" variant="ghost" size="sm" class="text-xs" disabled={closing}>
					{#if closing}<Loader2Icon class="size-3.5 animate-spin" />{:else}<RefreshCwIcon class="size-3.5" />{/if}
					Re-fetch
				</Button>
			</form>
		</div>
	{/if}

	<div class="card overflow-hidden divide-y divide-border">
		<div class="flex items-center justify-between px-5 py-3">
			<span class="text-sm text-foreground">Net Sales</span>
			<span class="text-sm tabular-nums text-foreground">{money(data.netSales)}</span>
		</div>
		<div class="flex items-center justify-between px-5 py-3">
			<span class="text-sm text-foreground">Cost of Goods Sold</span>
			<span class="text-sm tabular-nums text-red-600">-{money(data.cogs)}</span>
		</div>
		<div class="flex items-center justify-between px-5 py-3 bg-muted/30">
			<span class="text-sm font-semibold text-foreground">Gross Profit</span>
			<span class="text-sm font-semibold tabular-nums text-foreground">{money(data.grossProfit)}</span>
		</div>
	</div>

	<div class="card overflow-hidden mt-5">
		<div class="px-5 py-3 border-b border-border">
			<h2 class="text-sm font-semibold text-foreground">Operating Expenses</h2>
		</div>
		{#if data.expensesByCategory.length === 0}
			<div class="px-5 py-6 text-center text-sm text-muted-foreground">No expenses recorded this month.</div>
		{:else}
			<div class="divide-y divide-border">
				{#each data.expensesByCategory as row}
					<div class="flex items-center justify-between px-5 py-2.5 text-sm">
						<span class="text-foreground">{row.category}</span>
						<span class="tabular-nums text-foreground">{money(row.amount)}</span>
					</div>
				{/each}
			</div>
		{/if}
		<div class="flex items-center justify-between px-5 py-2.5 border-t border-border">
			<span class="text-sm text-foreground">Damages / Shrinkage</span>
			<span class="text-sm tabular-nums text-foreground">{money(data.totalDamages)}</span>
		</div>
		<div class="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
			<span class="text-sm font-semibold text-foreground">Total Expenses</span>
			<span class="text-sm font-semibold tabular-nums text-foreground">{money(data.totalExpenses + data.totalDamages)}</span>
		</div>
	</div>

	<div class="card overflow-hidden mt-5">
		<div class="flex items-center justify-between px-5 py-4">
			<span class="text-sm font-bold text-foreground">Net Income</span>
			<span class="text-sm font-bold tabular-nums {data.netIncome < 0 ? 'text-red-600' : 'text-green-700'}">
				{money(data.netIncome)}
			</span>
		</div>
	</div>

	<p class="text-xs text-muted-foreground mt-4">
		COGS uses each SKU's average cost as of when sales were recorded — backfill any missing Purchases before recording sales for the most accurate number.
	</p>
</div>
