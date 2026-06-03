<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatCurrency, formatDate, formatRelativeDate } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.searchQ ?? '');
	let searchTimeout: ReturnType<typeof setTimeout>;

	const tabs = [
		{ key: 'all', label: 'All' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'fulfilled', label: 'Fulfilled' },
		{ key: 'cancelled', label: 'Cancelled' },
		{ key: 'returned', label: 'Returned' }
	];

	function getStatusClass(financial: string, fulfillment: string): string {
		if (financial === 'REFUNDED') return 'badge-returned';
		if (fulfillment === 'FULFILLED') return 'badge-fulfilled';
		if (financial === 'PENDING') return 'badge-pending';
		if (fulfillment === 'UNFULFILLED') return 'badge-pending';
		return 'badge-partial';
	}

	function getStatusLabel(financial: string, fulfillment: string): string {
		if (financial === 'REFUNDED') return 'Refunded';
		if (fulfillment === 'FULFILLED') return 'Fulfilled';
		if (fulfillment === 'PARTIALLY_FULFILLED') return 'Partial';
		if (financial === 'PENDING') return 'Pending';
		return fulfillment.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function navigate(params: Record<string, string | null>) {
		const sp = new URLSearchParams($page.url.searchParams);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) sp.delete(k);
			else sp.set(k, v);
		}
		// Reset pagination on filter/search change
		sp.delete('after');
		sp.delete('before');
		goto(`?${sp}`);
	}

	function onSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			navigate({ q: searchInput || null });
		}, 350);
	}

	function setStatus(key: string) {
		navigate({ status: key === 'all' ? null : key });
	}

	function nextPage() {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('after', data.pageInfo.endCursor);
		sp.delete('before');
		goto(`?${sp}`);
	}

	function prevPage() {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('before', data.pageInfo.startCursor);
		sp.delete('after');
		goto(`?${sp}`);
	}

	const storeId = $derived($page.params.storeId);
</script>

<svelte:head>
	<title>Orders — {data.currentStore?.nickname ?? 'Store'}</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<!-- Toolbar -->
	<div class="flex items-center justify-between gap-4 mb-5">
		<div class="flex-1 max-w-sm relative">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="search"
				class="input pl-9"
				placeholder="Search by order #, name, phone…"
				bind:value={searchInput}
				oninput={onSearch}
			/>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<button
				onclick={() => invalidateAll()}
				class="btn-secondary btn-icon"
				title="Refresh orders"
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
			</button>
			<a href="/dashboard/stores/{storeId}/orders/new" class="btn-primary">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				New Order
			</a>
		</div>
	</div>

	<!-- Status tabs -->
	<div class="flex items-center gap-1 mb-5 border-b border-border overflow-x-auto">
		{#each tabs as tab}
			<button
				onclick={() => setStatus(tab.key)}
				class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px cursor-pointer whitespace-nowrap
					{(data.status ?? 'all') === tab.key
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
				{#if tab.key === 'pending' && data.pendingCount > 0}
					<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
						{data.pendingCount}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Orders table -->
	{#if data.orders.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No orders found</h3>
			<p class="text-sm text-muted-foreground">
				{searchInput ? `No results for "${searchInput}"` : 'No orders in this category yet'}
			</p>
		</div>
	{:else}
		<!-- Desktop table -->
		<div class="card overflow-hidden hidden md:block">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/30">
							<th class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Order</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
							<th class="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Payment</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Fulfillment</th>
							<th class="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Items</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Destination</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.orders as order}
							<tr
								class="hover:bg-muted/30 transition-colors cursor-pointer"
								onclick={() => goto(`/dashboard/stores/${storeId}/orders/${order.id.split('/').pop()}`)}
							>
								<td class="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{order.name}</td>
								<td class="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatRelativeDate(order.createdAt)}</td>
								<td class="px-4 py-3">
									<div class="font-medium text-foreground">{order.customer?.displayName ?? 'Guest'}</div>
									{#if order.customer?.phone}<div class="text-xs text-muted-foreground">{order.customer.phone}</div>{/if}
								</td>
								<td class="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
									{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
										{order.displayFinancialStatus === 'PAID' ? 'bg-green-100 text-green-800' :
										 order.displayFinancialStatus === 'PENDING' ? 'bg-amber-100 text-amber-800' :
										 order.displayFinancialStatus === 'REFUNDED' ? 'bg-red-100 text-red-700' :
										 'bg-zinc-100 text-zinc-600'}">
										<span class="size-1.5 rounded-full bg-current"></span>
										{order.displayFinancialStatus.replace(/_/g,' ')}
									</span>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
										{order.displayFulfillmentStatus === 'FULFILLED' ? 'bg-green-100 text-green-800' :
										 order.displayFulfillmentStatus === 'UNFULFILLED' ? 'bg-amber-100 text-amber-800' :
										 'bg-zinc-100 text-zinc-600'}">
										<span class="size-1.5 rounded-full bg-current"></span>
										{order.displayFulfillmentStatus.replace(/_/g,' ')}
									</span>
								</td>
								<td class="px-4 py-3 text-center text-muted-foreground text-xs">
								{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)} items
							</td>
								<td class="px-4 py-3 text-xs whitespace-nowrap">
									{#if order.shippingAddress}
										<div class="font-medium text-foreground">{order.shippingAddress.city}</div>
										<div class="text-muted-foreground">{order.shippingAddress.country}</div>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.pageInfo.hasNextPage}
				<div class="flex items-center justify-end px-4 py-3 border-t border-border">
					<button class="btn-secondary btn-sm" onclick={nextPage}>Next →</button>
				</div>
			{/if}
		</div>

		<!-- Mobile card list -->
		<div class="md:hidden space-y-2">
			{#each data.orders as order}
				<button
					class="card w-full text-left p-4 hover:shadow-md transition-shadow active:scale-[0.99]"
					onclick={() => goto(`/dashboard/stores/${storeId}/orders/${order.id.split('/').pop()}`)}
				>
					<div class="flex items-start justify-between gap-2 mb-2">
						<span class="font-bold text-foreground">{order.name}</span>
						<span class="{getStatusClass(order.displayFinancialStatus, order.displayFulfillmentStatus)} shrink-0">
							{getStatusLabel(order.displayFinancialStatus, order.displayFulfillmentStatus)}
						</span>
					</div>
					<div class="flex items-end justify-between gap-2">
						<div>
							<div class="text-sm text-muted-foreground">{order.customer?.displayName ?? 'Unknown'}</div>
							{#if order.customer?.phone}<div class="text-xs text-muted-foreground">{order.customer.phone}</div>{/if}
							<div class="text-xs text-muted-foreground mt-0.5">{formatDate(order.createdAt)}</div>
						</div>
						<span class="font-semibold text-foreground shrink-0">
							{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
						</span>
					</div>
				</button>
			{/each}
			{#if data.pageInfo.hasNextPage}
				<button class="btn-secondary w-full" onclick={nextPage}>Load more</button>
			{/if}
		</div>
	{/if}
</div>
