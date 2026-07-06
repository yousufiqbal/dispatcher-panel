<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page, navigating } from '$app/stores';
	import { formatCurrency, formatDate, formatRelativeDate } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.searchQ ?? '');
	let searchTimeout: ReturnType<typeof setTimeout>;

	const tabs = [
		{ key: 'all', label: 'All' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'confirmed', label: 'Confirmed' },
		{ key: 'fulfilled', label: 'Fulfilled' },
		{ key: 'cancelled', label: 'Cancelled' },
		{ key: 'returned', label: 'Returned' },
		{ key: 'drafts', label: 'Drafts', separator: true }
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
		sp.delete('page');
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

	const storeId = $derived($page.params.storeId);

	// Shopify's GraphQL API only offers forward cursor pagination (no arbitrary
	// page offsets), so we cache the cursor seen at each page number per filter
	// combo and let numeric buttons jump back to any page already visited.
	const cursorKey = $derived(`orders-pager:${storeId}:${data.status ?? 'all'}:${data.searchQ ?? ''}`);
	const currentPage = $derived(Number($page.url.searchParams.get('page') ?? '1'));
	let cursors = $state<Record<number, string | undefined>>({ 1: undefined });

	$effect(() => {
		cursorKey;
		try {
			const raw = sessionStorage.getItem(cursorKey);
			cursors = raw ? JSON.parse(raw) : { 1: undefined };
		} catch {
			cursors = { 1: undefined };
		}
	});

	function goToPage(n: number) {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('page', String(n));
		const c = cursors[n];
		if (c) sp.set('after', c);
		else sp.delete('after');
		goto(`?${sp}`);
	}

	function nextPage() {
		const next = currentPage + 1;
		const updated = { ...cursors, [next]: data.pageInfo.endCursor };
		cursors = updated;
		try {
			sessionStorage.setItem(cursorKey, JSON.stringify(updated));
		} catch {
			/* sessionStorage unavailable */
		}
		goToPage(next);
	}

	const maxCachedPage = $derived(Math.max(1, ...Object.keys(cursors).map(Number)));
	const pageButtons = $derived.by(() => {
		const total = maxCachedPage;
		const start = Math.max(1, currentPage - 3);
		const end = Math.min(total, currentPage + 3);
		const nums: number[] = [];
		for (let i = start; i <= end; i++) nums.push(i);
		return nums;
	});
</script>

{#snippet pagination()}
	<div class="flex items-center justify-between px-4 py-2.5 border-t border-border">
		<span class="text-xs text-muted-foreground">Page {currentPage}</span>
		<div class="flex items-center gap-1">
			<button class="btn-secondary btn-sm" disabled={currentPage <= 1} onclick={() => goToPage(currentPage - 1)}>←</button>
			{#each pageButtons as n}
				<button
					class="btn-sm min-w-[2rem] {n === currentPage ? 'btn-primary' : 'btn-secondary'}"
					onclick={() => goToPage(n)}
				>
					{n}
				</button>
			{/each}
			<button class="btn-secondary btn-sm" disabled={!data.pageInfo.hasNextPage} onclick={nextPage}>→</button>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>Orders — {data.currentStore?.name ?? 'Store'}</title>
</svelte:head>

{#if $navigating}
	<div class="fixed top-0 left-0 right-0 h-0.5 bg-primary z-50 overflow-hidden">
		<div class="h-full w-1/3 bg-primary-foreground/40 animate-[loading-bar_1s_ease-in-out_infinite]"></div>
	</div>
{/if}

<div class="p-3 sm:p-6">
	<!-- Toolbar -->
	<div class="flex items-center justify-between gap-3 sm:gap-4 mb-5">
		<div class="flex-1 min-w-0 sm:max-w-sm relative">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="search"
				class="input pl-9"
				placeholder="Order #, name, phone…"
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
			<a href="/dashboard/stores/{storeId}/orders/new" class="btn-primary size-9 p-0 sm:size-auto sm:px-4 sm:py-2">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				<span class="hidden sm:inline">New Order</span>
			</a>
		</div>
	</div>

	<!-- Status tabs -->
	<div class="flex items-center gap-1 mb-5 border-b border-border overflow-x-auto overflow-y-hidden">
		{#each tabs as tab}
			{#if tab.separator}
				<div class="w-px h-5 bg-border self-center mx-1 shrink-0"></div>
			{/if}
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
				{#if tab.key === 'confirmed' && data.confirmedCount > 0}
					<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
						{data.confirmedCount}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="transition-opacity duration-150 {$navigating ? 'opacity-40 pointer-events-none' : ''}">
	<!-- Drafts table -->
	{#if data.status === 'drafts'}
		{#if data.drafts.length === 0}
			<div class="card p-12 text-center">
				<svg class="size-12 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<h3 class="font-semibold text-foreground mb-1">No draft orders</h3>
				<p class="text-sm text-muted-foreground">Duplicated orders appear here as drafts.</p>
			</div>
		{:else}
			<div class="card overflow-hidden hidden md:block">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border bg-muted/30">
								<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Draft</th>
								<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Updated</th>
								<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Customer</th>
								<th class="text-right px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Total</th>
								<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Status</th>
								<th class="text-center px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Items</th>
								<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide">Destination</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each data.drafts as draft}
								<tr
									class="hover:bg-muted/40 transition-colors cursor-pointer"
									onclick={() => goto(`/dashboard/stores/${storeId}/draft-orders/${draft.legacyResourceId}`)}
								>
									<td class="px-3 py-1.5 font-bold text-foreground">{draft.name}</td>
									<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap">{formatRelativeDate(draft.updatedAt)}</td>
									<td class="px-3 py-1.5">
										<div class="font-medium text-foreground">{draft.customer?.displayName ?? 'Guest'}</div>
										{#if draft.customer?.email}<div class="text-xs text-foreground/60">{draft.customer.email}</div>{/if}
									</td>
									<td class="px-3 py-1.5 text-right font-semibold text-foreground whitespace-nowrap">{draft.totalPrice}</td>
									<td class="px-3 py-1.5">
										<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
											{draft.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
											 draft.status === 'INVOICE_SENT' ? 'bg-blue-100 text-blue-800' :
											 'bg-amber-100 text-amber-800'}">
											<span class="size-1.5 rounded-full bg-current shrink-0"></span>
											{draft.status.replace(/_/g, ' ')}
										</span>
									</td>
									<td class="px-3 py-1.5 text-center text-foreground/70">
										{draft.lineItems.nodes.reduce((s: number, i: any) => s + i.quantity, 0)}
									</td>
									<td class="px-3 py-1.5">
										{#if draft.shippingAddress}
											<div class="font-medium text-foreground">{draft.shippingAddress.city}</div>
											<div class="text-xs text-foreground/60">{draft.shippingAddress.country}</div>
										{:else}
											<span class="text-foreground/40">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{@render pagination()}
			</div>
			<!-- Mobile -->
			<div class="md:hidden space-y-2">
				{#each data.drafts as draft}
					<button
						class="card w-full text-left p-4 hover:shadow-md transition-shadow"
						onclick={() => goto(`/dashboard/stores/${storeId}/draft-orders/${draft.legacyResourceId}`)}
					>
						<div class="flex items-start justify-between gap-2 mb-2">
							<span class="font-bold text-foreground">{draft.name}</span>
							<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{draft.status.replace(/_/g, ' ')}</span>
						</div>
						<div class="flex items-end justify-between gap-2">
							<div>
								<div class="text-sm text-muted-foreground">{draft.customer?.displayName ?? 'Guest'}</div>
								<div class="text-xs text-muted-foreground mt-0.5">{formatRelativeDate(draft.updatedAt)}</div>
							</div>
							<span class="font-semibold text-foreground">{draft.totalPrice}</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Orders table -->
	{#if data.status !== 'drafts'}
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
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Order</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Date</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Customer</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Phone</th>
							<th class="text-right px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Total</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Payment</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Fulfillment</th>
							<th class="text-center px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Items</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Destination</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.orders as order}
							<tr
								class="hover:bg-muted/40 transition-colors cursor-pointer"
								onclick={() => goto(`/dashboard/stores/${storeId}/orders/${order.id.split('/').pop()}`)}
							>
								<td class="px-3 py-1.5 font-bold text-foreground whitespace-nowrap">{order.name}</td>
								<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap">{formatRelativeDate(order.createdAt)}</td>
								<td class="px-3 py-1.5">
									<div class="font-medium text-foreground">{order.customer?.displayName ?? 'Guest'}</div>
								</td>
								<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap font-mono text-xs">
									{#if order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}
										<a
											href="tel:{order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}"
											class="hover:text-primary hover:underline"
											onclick={(e) => e.stopPropagation()}
										>{order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}</a>
									{:else}
										—
									{/if}
								</td>
								<td class="px-3 py-1.5 text-right font-semibold text-foreground whitespace-nowrap">
									{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
								</td>
								<td class="px-3 py-1.5">
									<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
										{order.displayFinancialStatus === 'PAID' ? 'bg-green-100 text-green-800' :
										 order.displayFinancialStatus === 'PENDING' ? 'bg-amber-100 text-amber-800' :
										 order.displayFinancialStatus === 'REFUNDED' ? 'bg-red-100 text-red-700' :
										 'bg-zinc-100 text-zinc-700'}">
										<span class="size-1.5 rounded-full bg-current shrink-0"></span>
										{order.displayFinancialStatus.replace(/_/g,' ')}
									</span>
								</td>
								<td class="px-3 py-1.5">
									<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
										{order.displayFulfillmentStatus === 'FULFILLED' ? 'bg-green-100 text-green-800' :
										 order.displayFulfillmentStatus === 'UNFULFILLED' ? 'bg-amber-100 text-amber-800' :
										 'bg-zinc-100 text-zinc-700'}">
										<span class="size-1.5 rounded-full bg-current shrink-0"></span>
										{order.displayFulfillmentStatus.replace(/_/g,' ')}
									</span>
								</td>
								<td class="px-3 py-1.5 text-center text-foreground/70">
									{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)}
								</td>
								<td class="px-3 py-1.5 whitespace-nowrap">
									{#if order.shippingAddress}
										<div class="font-medium text-foreground">{order.shippingAddress.city}</div>
										<div class="text-xs text-foreground/60">{order.shippingAddress.country}</div>
									{:else}
										<span class="text-foreground/40">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{@render pagination()}
		</div>

		<!-- Mobile card list -->
		<div class="md:hidden card overflow-hidden">
			<div class="divide-y divide-border">
				{#each data.orders as order}
					<button
						class="w-full text-left p-4 hover:bg-muted/30 transition-colors active:bg-muted/40"
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
								{#if order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}<div class="text-xs text-muted-foreground">{order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}</div>{/if}
								<div class="text-xs text-muted-foreground mt-0.5">
									{formatDate(order.createdAt)} · {order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)} item{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}
								</div>
							</div>
							<span class="font-semibold text-foreground shrink-0">
								{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
							</span>
						</div>
					</button>
				{/each}
			</div>
			{#if data.pageInfo.hasNextPage}
				<div class="p-3 border-t border-border">
					<button class="btn-secondary w-full" onclick={nextPage}>Load more</button>
				</div>
			{/if}
		</div>
	{/if}
	{/if}
	</div>
</div>
