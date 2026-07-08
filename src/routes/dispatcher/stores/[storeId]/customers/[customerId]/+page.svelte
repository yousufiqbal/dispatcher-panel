<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency, formatDateShort, shopifyIdToNumber } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const storeId = $derived($page.params.storeId);
	let editing = $state(false);
	const customer = $derived(data.customer);
</script>

<svelte:head>
	<title>{customer.displayName} — Customers</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6">
		<div class="flex items-center gap-4">
			<Button href="/dispatcher/stores/{storeId}/customers" variant="outline" size="icon" class="shrink-0" title="Back to Customers">
				<ArrowLeftIcon class="size-4" />
			</Button>
			<div>
				<h1 class="text-2xl font-bold">{customer.displayName}</h1>
				<p class="text-sm text-muted-foreground">{customer.numberOfOrders} order{customer.numberOfOrders !== 1 ? 's' : ''}</p>
			</div>
		</div>
		<div class="flex gap-2 mt-3">
			<Button href="/dispatcher/stores/{storeId}/orders/new?customerId={encodeURIComponent(customer.id)}">
				New Order
			</Button>
			<Button variant="outline" onclick={() => editing = !editing}>
				{editing ? 'Cancel Edit' : 'Edit'}
			</Button>
		</div>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">Customer updated successfully.</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Customer info -->
		<div class="lg:col-span-1 space-y-4">
			{#if editing}
				<div class="card p-5">
					<h2 class="font-semibold mb-4">Edit Customer</h2>
					<form method="POST" action="?/update" use:enhance class="space-y-3">
						<div class="space-y-1.5">
							<Label class="text-xs">First Name</Label>
							<Input name="firstName" value={customer.firstName ?? ''} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs">Last Name</Label>
							<Input name="lastName" value={customer.lastName ?? ''} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs">Email</Label>
							<Input name="email" type="email" value={customer.email ?? ''} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs">Phone</Label>
							<Input name="phone" type="tel" value={customer.phone ?? ''} />
						</div>
						<Button type="submit" class="w-full">Save</Button>
					</form>
				</div>
			{:else}
				<div class="card p-5">
					<h2 class="font-semibold mb-3">Contact Info</h2>
					<dl class="space-y-3 text-sm">
						{#if customer.email}
							<div>
								<dt class="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Email</dt>
								<dd class="font-medium">{customer.email}</dd>
							</div>
						{/if}
						{#if customer.phone}
							<div>
								<dt class="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Phone</dt>
								<dd class="font-medium">{customer.phone}</dd>
							</div>
						{/if}
						{#if customer.defaultAddress}
							<div>
								<dt class="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Default Address</dt>
								<dd class="text-muted-foreground text-xs">
									{customer.defaultAddress.address1}<br/>
									{customer.defaultAddress.city}, {customer.defaultAddress.country}
								</dd>
							</div>
						{/if}
					</dl>
				</div>
				<div class="card p-5">
					<div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Shopify ID</div>
					<code class="text-xs font-mono text-muted-foreground">{shopifyIdToNumber(customer.id)}</code>
				</div>
			{/if}
		</div>

		<!-- Order history -->
		<div class="lg:col-span-2">
			<div class="card">
				<div class="card-header pb-3">
					<h2 class="font-semibold">Order History</h2>
				</div>
				{#if customer.orders.nodes.length === 0}
					<div class="card-content text-center py-8">
						<p class="text-sm text-muted-foreground">No orders yet</p>
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each customer.orders.nodes as order}
							<a
								href="/dispatcher/stores/{storeId}/orders/{encodeURIComponent(order.id)}"
								class="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
							>
								<div>
									<span class="font-semibold text-sm text-foreground">{order.name}</span>
									<div class="text-xs text-muted-foreground">{formatDateShort(order.createdAt)}</div>
								</div>
								<div class="flex items-center gap-3">
									<span class="badge badge-partial text-xs">{order.displayFinancialStatus}</span>
									<span class="font-medium text-sm">{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
									<ChevronRightIcon class="size-4 text-muted-foreground" />
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
