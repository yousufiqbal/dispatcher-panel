<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency, formatDate } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const order = $derived(data.order);

	onMount(() => {
		setTimeout(() => window.print(), 300);
	});
</script>

<svelte:head>
	<title>Invoice {order.name}</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-8 print:p-0 text-sm text-zinc-900">
	<div class="flex items-start justify-between mb-8 print:hidden">
		<button
			type="button"
			class="btn-primary"
			onclick={() => window.print()}
		>
			Print / Save as PDF
		</button>
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

	<table class="w-full mb-6 border-collapse">
		<thead>
			<tr class="border-b-2 border-zinc-300">
				<th class="text-left py-2 font-semibold">Item</th>
				<th class="text-center py-2 font-semibold">Qty</th>
				<th class="text-right py-2 font-semibold">Price</th>
				<th class="text-right py-2 font-semibold">Total</th>
			</tr>
		</thead>
		<tbody>
			{#each order.lineItems.nodes as item}
				<tr class="border-b border-zinc-200">
					<td class="py-2">
						<div class="font-medium">{item.title}</div>
						{#if item.variant?.title && item.variant.title !== 'Default Title'}
							<div class="text-xs text-zinc-500">{item.variant.title}</div>
						{/if}
						{#if item.variant?.sku}
							<div class="text-xs text-zinc-500 font-mono">SKU: {item.variant.sku}</div>
						{/if}
					</td>
					<td class="text-center py-2">{item.quantity}</td>
					<td class="text-right py-2">
						{formatCurrency(item.originalUnitPriceSet.shopMoney.amount, item.originalUnitPriceSet.shopMoney.currencyCode)}
					</td>
					<td class="text-right py-2">
						{formatCurrency(
							(parseFloat(item.originalUnitPriceSet.shopMoney.amount) * item.quantity).toFixed(2),
							item.originalUnitPriceSet.shopMoney.currencyCode
						)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="flex justify-end">
		<div class="w-56 space-y-1.5">
			<div class="flex justify-between">
				<span class="text-zinc-500">Subtotal</span>
				<span>{formatCurrency(order.subtotalPriceSet?.shopMoney?.amount ?? '0', order.totalPriceSet.shopMoney.currencyCode)}</span>
			</div>
			{#each order.shippingLines.nodes as line}
				<div class="flex justify-between">
					<span class="text-zinc-500">{line.title}</span>
					<span>{formatCurrency(line.originalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
				</div>
			{/each}
			<div class="flex justify-between font-bold border-t border-zinc-300 pt-1.5">
				<span>Total</span>
				<span>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
			</div>
			<div class="flex justify-between text-zinc-500">
				<span>Paid</span>
				<span>{formatCurrency(order.totalReceivedSet?.shopMoney?.amount ?? '0', order.totalPriceSet.shopMoney.currencyCode)}</span>
			</div>
		</div>
	</div>

	{#if order.note}
		<div class="mt-8 pt-4 border-t border-zinc-200">
			<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Note</div>
			<p>{order.note}</p>
		</div>
	{/if}
</div>
