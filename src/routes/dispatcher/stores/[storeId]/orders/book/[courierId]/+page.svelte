<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency } from '$lib/utils';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
	const storeId = $derived($page.params.storeId);
	const ids = $derived(data.orders.map((o) => o.id.split('/').pop()).join(','));
</script>

<svelte:head>
	<title>Book {data.courierLabel} — Orders</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<a href="/dispatcher/stores/{storeId}/orders?status=confirmed" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
		Back to Confirmed
	</a>

	<h1 class="text-2xl font-bold mb-1">Book {data.courierLabel}</h1>
	<p class="text-sm text-muted-foreground mb-6">{data.orders.length} order{data.orders.length !== 1 ? 's' : ''} selected</p>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">{form.error}</div>
	{/if}

	{#if data.cityWarnings.length > 0}
		<div class="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6">
			<p class="font-medium mb-1">City not in {data.courierLabel}'s delivery list:</p>
			<ul class="list-disc list-inside space-y-0.5">
				{#each data.cityWarnings as w}
					<li>{w.orderName} — "{w.city}"</li>
				{/each}
			</ul>
			<p class="text-xs text-amber-700 mt-1">Booking may still work, but double-check the address before proceeding.</p>
		</div>
	{/if}

	<div class="card mb-5">
		<div class="divide-y divide-border">
			{#each data.orders as order}
				<div class="px-5 py-3 flex items-center justify-between text-sm">
					<div>
						<div class="font-medium text-foreground">{order.name}</div>
						<div class="text-xs text-muted-foreground">{order.customer?.displayName ?? 'Guest'}</div>
					</div>
					<span class="text-muted-foreground">{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="card">
		<div class="card-content pt-6">
			<form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }} class="space-y-4">
				<input type="hidden" name="ids" value={ids} />

				<div class="space-y-1.5">
					<label class="label" for="weight">Weight (g)</label>
					<input id="weight" name="weight" class="input" value={data.defaults.weight} placeholder="500" />
				</div>

				<div class="space-y-1.5">
					<label class="label" for="codAmount">COD Amount</label>
					<input id="codAmount" name="codAmount" class="input" placeholder="Leave blank to use each order's total" />
					<p class="text-xs text-muted-foreground">Applied to every selected order, unless left blank (then each order's own total is used).</p>
				</div>

				<label class="flex items-center gap-2 text-sm cursor-pointer">
					<input type="checkbox" name="fragile" value="true" checked={data.defaults.fragile} class="rounded border-border" />
					Fragile
				</label>

				<div class="space-y-1.5">
					<label class="label" for="note">Note</label>
					<input id="note" name="note" class="input" value={data.defaults.note} placeholder="Optional note for the courier" />
				</div>

				<button type="submit" class="btn-primary w-full" disabled={submitting}>
					{submitting ? 'Booking…' : `Book ${data.orders.length} Order${data.orders.length !== 1 ? 's' : ''} with ${data.courierLabel}`}
				</button>
			</form>
		</div>
	</div>
</div>
