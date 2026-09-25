<script lang="ts">
	import { formatCurrency, formatDate } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const order = $derived(data.order);
	const currency = $derived(order.totalPriceSet.shopMoney.currencyCode);

	// Removed items (currentQuantity 0) don't belong on an invoice.
	const items = $derived(order.lineItems.nodes.filter((i) => i.currentQuantity > 0));

	const money = (amount: number | string) =>
		formatCurrency(typeof amount === 'number' ? amount.toFixed(2) : amount, currency);

	// What was taken off this line, and what to call it. Prefer the discount's
	// own name (a manual "Custom discount", an automatic title, or a code) and
	// fall back to the unit-price gap when there's no allocation to read.
	function lineDiscount(item: (typeof order.lineItems.nodes)[number]) {
		const allocated = item.discountAllocations.reduce(
			(sum, d) => sum + parseFloat(d.allocatedAmountSet.shopMoney.amount),
			0
		);
		const unitGap =
			parseFloat(item.originalUnitPriceSet.shopMoney.amount) -
			parseFloat(item.discountedUnitPriceSet.shopMoney.amount);
		const amount = allocated > 0 ? allocated : Math.max(0, unitGap) * item.currentQuantity;
		if (amount <= 0) return null;

		const named = item.discountAllocations
			.map((d) => d.discountApplication?.title ?? d.discountApplication?.code)
			.find((label): label is string => !!label);
		return { amount, label: named ?? null };
	}

	const outstanding = $derived(
		order.totalOutstandingSet?.shopMoney?.amount ??
			(
				parseFloat(order.totalPriceSet.shopMoney.amount) -
				parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0')
			).toFixed(2)
	);
</script>

<svelte:head>
	<title>Invoice {order.name}</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-8 print:p-0 text-sm text-zinc-900">
	<div class="flex items-start justify-between mb-8 print:hidden">
		<Button onclick={() => window.print()}>
			Print / Save as PDF
		</Button>
	</div>

	<div class="flex items-start justify-between mb-8">
		<div>
			<h1 class="text-xl font-bold">{data.storeName}</h1>
			<p class="text-zinc-500 mt-1">Invoice</p>
		</div>
		<div class="text-right">
			<div class="text-lg font-bold">{order.name}</div>
			<div class="text-zinc-500">{formatDate(order.createdAt)}</div>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-6 mb-8">
		<div>
			<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Bill To</div>
			{#if order.customer}
				<div class="font-medium">{order.customer.displayName}</div>
				{#if order.customer.email}<div>{order.customer.email}</div>{/if}
				{#if order.customer.phone ?? order.phone}<div>{order.customer.phone ?? order.phone}</div>{/if}
			{:else}
				<div>Guest</div>
			{/if}
		</div>
		{#if order.shippingAddress}
			<div>
				<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Ship To</div>
				<div class="font-medium">{order.shippingAddress.name}</div>
				<div>{order.shippingAddress.address1}</div>
				<div>{order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}</div>
				<div>{order.shippingAddress.country}</div>
				{#if order.shippingAddress.phone}<div>{order.shippingAddress.phone}</div>{/if}
			</div>
		{/if}
	</div>

	<h2 class="font-bold mb-2">Order Details</h2>

	<table class="w-full mb-6 border-collapse">
		<thead>
			<tr class="border-y border-zinc-300 bg-zinc-50">
				<th class="text-left py-2 px-3 font-semibold w-12">Qty</th>
				<th class="text-left py-2 px-3 font-semibold">Item</th>
				<th class="text-right py-2 px-3 font-semibold w-32">Price</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item}
				{@const discount = lineDiscount(item)}
				{@const original = item.originalUnitPriceSet.shopMoney.amount}
				{@const discounted = item.discountedUnitPriceSet.shopMoney.amount}
				<tr class="border-b border-zinc-200 align-top">
					<td class="py-2 px-3">{item.currentQuantity}</td>
					<td class="py-2 px-3">
						<div>
							{item.title}{#if item.variant?.title && item.variant.title !== 'Default Title'} - {item.variant.title}{/if}
						</div>
						{#if discount}
							<div class="text-xs text-zinc-500">
								{#if discount.label}{discount.label} {/if}(-{money(discount.amount)})
							</div>
						{/if}
					</td>
					<td class="text-right py-2 px-3 whitespace-nowrap">
						{#if discount}
							<span class="text-zinc-400 line-through">{money(original)}</span>
							<span>{money(discounted)}</span>
						{:else}
							{money(original)}
						{/if}
					</td>
				</tr>
			{/each}

			<!-- Totals live in the same table so the money column stays aligned
			     with the line items above it. -->
			<tr class="border-b border-zinc-200">
				<td colspan="2" class="text-right py-2 px-3 text-zinc-600">Subtotal</td>
				<td class="text-right py-2 px-3 whitespace-nowrap">{money(order.subtotalPriceSet?.shopMoney?.amount ?? '0')}</td>
			</tr>
			<tr class="border-b border-zinc-200">
				<td colspan="2" class="text-right py-2 px-3 text-zinc-600">Shipping</td>
				<td class="text-right py-2 px-3 whitespace-nowrap">{money(order.totalShippingPriceSet?.shopMoney?.amount ?? '0')}</td>
			</tr>
			<tr class="border-b border-zinc-200 font-bold">
				<td colspan="2" class="text-right py-2 px-3">Total</td>
				<td class="text-right py-2 px-3 whitespace-nowrap">{money(order.totalPriceSet.shopMoney.amount)}</td>
			</tr>
			<tr class="border-b border-zinc-200">
				<td colspan="2" class="text-right py-2 px-3 text-zinc-600">Total Paid</td>
				<td class="text-right py-2 px-3 whitespace-nowrap">{money(order.totalReceivedSet?.shopMoney?.amount ?? '0')}</td>
			</tr>
			<tr class="font-bold">
				<td colspan="2" class="text-right py-2 px-3">Outstanding Amount</td>
				<td class="text-right py-2 px-3 whitespace-nowrap">{money(outstanding)}</td>
			</tr>
		</tbody>
	</table>

	{#if order.note}
		<div class="mt-8 pt-4 border-t border-zinc-200">
			<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Note</div>
			<p>{order.note}</p>
		</div>
	{/if}
</div>
