<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency, formatDateShort, shopifyIdToNumber } from '$lib/utils';
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
			<a href="/dashboard/stores/{storeId}/customers" class="btn-secondary btn-icon shrink-0" title="Back to Customers">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div class="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
				{customer.displayName[0]?.toUpperCase() ?? '?'}
			</div>
			<div>
				<h1 class="text-2xl font-bold">{customer.displayName}</h1>
				<p class="text-sm text-muted-foreground">{customer.numberOfOrders} order{customer.numberOfOrders !== 1 ? 's' : ''}</p>
			</div>
			<div class="ml-auto flex gap-2">
				<a href="/dashboard/stores/{storeId}/orders/new?customerId={encodeURIComponent(customer.id)}" class="btn-primary">
					New Order
				</a>
				<button class="btn-secondary" onclick={() => editing = !editing}>
					{editing ? 'Cancel Edit' : 'Edit'}
				</button>
			</div>
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
							<label class="label text-xs">First Name</label>
							<input name="firstName" class="input" value={customer.firstName ?? ''} />
						</div>
						<div class="space-y-1.5">
							<label class="label text-xs">Last Name</label>
							<input name="lastName" class="input" value={customer.lastName ?? ''} />
						</div>
						<div class="space-y-1.5">
							<label class="label text-xs">Email</label>
							<input name="email" type="email" class="input" value={customer.email ?? ''} />
						</div>
						<div class="space-y-1.5">
							<label class="label text-xs">Phone</label>
							<input name="phone" type="tel" class="input" value={customer.phone ?? ''} />
						</div>
						<button type="submit" class="btn-primary w-full">Save</button>
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
								href="/dashboard/stores/{storeId}/orders/{encodeURIComponent(order.id)}"
								class="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
							>
								<div>
									<span class="font-semibold text-sm text-foreground">{order.name}</span>
									<div class="text-xs text-muted-foreground">{formatDateShort(order.createdAt)}</div>
								</div>
								<div class="flex items-center gap-3">
									<span class="badge badge-partial text-xs">{order.displayFinancialStatus}</span>
									<span class="font-medium text-sm">{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
									<svg class="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
