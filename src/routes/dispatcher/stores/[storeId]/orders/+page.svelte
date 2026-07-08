<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page, navigating } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { formatCurrency, formatDate, formatRelativeDate } from '$lib/utils';
	import { deliveryPill } from '$lib/delivery-status';
	import SearchIcon from '@lucide/svelte/icons/search';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.searchQ ?? '');
	let searchTimeout: ReturnType<typeof setTimeout>;

	let selectedIds = $state<Set<string>>(new Set());
	let copiedPhone = $state<string | null>(null);
	let refreshing = $state(false);

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll(ids: string[]) {
		selectedIds = selectedIds.size === ids.length ? new Set() : new Set(ids);
	}

	function bookSelected(courierId: string) {
		const ids = [...selectedIds].map((gid) => gid.split('/').pop()).join(',');
		goto(`/dispatcher/stores/${storeId}/orders/book/${courierId}?ids=${ids}`);
	}

	const selectableStatuses = ['pending', 'confirmed', 'fulfilled', 'attempted', 'failed'];
	let showBulkConfirmDialog = $state(false);
	let bulkConfirming = $state(false);

	function printLabels() {
		const ids = [...selectedIds].map((gid) => gid.split('/').pop()).join(',');
		window.open(`/dispatcher/stores/${storeId}/orders/labels?ids=${ids}`, '_blank');
	}

	// After booking, the redirect lands here with ?labels=<orderIds> — auto-download
	// the airway-bill PDF for the just-booked orders, then drop the param so a page
	// refresh doesn't re-download.
	$effect(() => {
		const labelIds = $page.url.searchParams.get('labels');
		if (!labelIds) return;
		const a = document.createElement('a');
		a.href = `/dispatcher/stores/${storeId}/orders/labels?ids=${labelIds}&download=1`;
		// `download` keeps SvelteKit's router from intercepting the click as a page
		// navigation (which would hang — the endpoint streams a PDF, not a page).
		a.download = '';
		document.body.appendChild(a);
		a.click();
		a.remove();
		const sp = new URLSearchParams($page.url.searchParams);
		sp.delete('labels');
		goto(`?${sp}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	const tabs = [
		{ key: 'all', label: 'All' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'confirmed', label: 'Confirmed' },
		{ key: 'fulfilled', label: 'Fulfilled' },
		{ key: 'attempted', label: 'Attempted' },
		{ key: 'failed', label: 'Failed' },
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

	function deliveryStatusInfo(order: {
		fulfillments: { displayStatus: string | null; trackingInfo: { number: string | null }[] }[];
	}): { label: string; class: string } | null {
		const hasTracking = order.fulfillments.some((f) => f.trackingInfo.some((t) => t.number));
		return deliveryPill(order.fulfillments.find((f) => f.displayStatus)?.displayStatus, hasTracking);
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
		selectedIds = new Set();
		goto(`?${sp}`, { keepFocus: true });
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

	let loadingMore = $state(false);

	$effect(() => {
		data;
		loadingMore = false;
	});

	function goToPage(n: number) {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('page', String(n));
		const c = cursors[n];
		if (c) sp.set('after', c);
		else sp.delete('after');
		goto(`?${sp}`, { keepFocus: true });
	}

	function nextPage() {
		loadingMore = true;
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
			<Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => goToPage(currentPage - 1)}>←</Button>
			{#each pageButtons as n}
				<Button
					size="sm"
					variant={n === currentPage ? 'default' : 'outline'}
					class="min-w-[2rem]"
					onclick={() => goToPage(n)}
				>
					{n}
				</Button>
			{/each}
			<Button variant="outline" size="sm" disabled={!data.pageInfo.hasNextPage || loadingMore} onclick={nextPage}>
				{#if loadingMore}
					<Loader2Icon class="size-3.5 animate-spin" />
				{:else}
					→
				{/if}
			</Button>
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
			<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
			<Input
				type="search"
				class="pl-9"
				placeholder="Search Orders"
				bind:value={searchInput}
				oninput={onSearch}
			/>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<Button
				onclick={async () => { refreshing = true; await invalidateAll(); refreshing = false; }}
				variant="outline"
				size="icon"
				title="Refresh orders"
				disabled={refreshing}
			>
				<RefreshCwIcon class="size-4 {refreshing ? 'animate-spin' : ''}" />
			</Button>
			<Button href="/dispatcher/stores/{storeId}/orders/new" class="size-9 p-0 sm:size-auto sm:px-4 sm:py-2">
				<PlusIcon class="size-4" />
				<span class="hidden sm:inline">New Order</span>
			</Button>
		</div>
	</div>

	<!-- Status tabs -->
	<div class="mb-5 pb-1 overflow-x-auto overflow-y-hidden">
		<Tabs.Root value={data.status ?? 'all'} onValueChange={setStatus}>
			<Tabs.List class="h-auto flex-nowrap">
				{#each tabs as tab}
					{#if tab.separator}
						<div class="w-px h-5 bg-border self-center mx-1 shrink-0"></div>
					{/if}
					<Tabs.Trigger value={tab.key} class="gap-1.5 shrink-0">
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
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</Tabs.Root>
	</div>

	{#if data.status === 'pending' && selectedIds.size > 0}
		<div class="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<Button size="sm" onclick={() => showBulkConfirmDialog = true}>Confirm Selected</Button>
		</div>
	{/if}

	{#if data.status === 'confirmed' && selectedIds.size > 0}
		<div class="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<div class="flex items-center gap-2">
				{#each data.couriers as courier}
					<Button variant="outline" size="sm" onclick={() => bookSelected(courier.id)}>Book with {courier.name}</Button>
				{/each}
				{#if data.couriers.length === 0}
					<span class="text-xs text-muted-foreground">No courier assigned to this store — set one up in Admin → Couriers</span>
				{/if}
			</div>
		</div>
	{/if}

	{#if ['fulfilled', 'attempted', 'failed'].includes(data.status) && selectedIds.size > 0}
		<div class="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<Button size="sm" onclick={printLabels}>
				<PrinterIcon class="size-4" />
				Print Labels
			</Button>
		</div>
	{/if}

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
									onclick={() => goto(`/dispatcher/stores/${storeId}/draft-orders/${draft.legacyResourceId}`)}
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
						onclick={() => goto(`/dispatcher/stores/${storeId}/draft-orders/${draft.legacyResourceId}`)}
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
							{#if selectableStatuses.includes(data.status)}
								<th class="px-3 py-2 w-8">
									<Checkbox
										checked={data.orders.length > 0 && selectedIds.size === data.orders.length}
										onCheckedChange={() => toggleSelectAll(data.orders.map((o) => o.id))}
									/>
								</th>
							{/if}
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Order</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Date</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Customer</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Phone</th>
							<th class="text-right px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Total</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Payment</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Fulfillment</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Delivery Status</th>
							<th class="text-center px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Items</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Destination</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.orders as order}
							{@const delivery = deliveryStatusInfo(order)}
							<tr
								class="hover:bg-muted/40 transition-colors cursor-pointer"
								onclick={() => goto(`/dispatcher/stores/${storeId}/orders/${order.id.split('/').pop()}`)}
							>
								{#if selectableStatuses.includes(data.status)}
									<td class="px-3 py-1.5" onclick={(e) => e.stopPropagation()}>
										<Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
									</td>
								{/if}
								<td class="px-3 py-1.5 font-bold text-foreground whitespace-nowrap">{order.name}</td>
								<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap">{formatRelativeDate(order.createdAt)}</td>
								<td class="px-3 py-1.5">
									<div class="font-medium text-foreground">{order.customer?.displayName ?? 'Guest'}</div>
								</td>
								<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap font-mono text-xs">
									{#if order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}
										{@const phone = order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone ?? ''}
										<span class="inline-flex items-center gap-1">
											<a href="tel:{phone}" class="hover:text-primary hover:underline" onclick={(e) => e.stopPropagation()}>{phone}</a>
											<button
												type="button"
												class="text-muted-foreground hover:text-primary"
												title="Copy phone number"
												onclick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(phone); copiedPhone = phone; setTimeout(() => copiedPhone === phone && (copiedPhone = null), 1200); }}
											>
												{#if copiedPhone === phone}
													<CheckIcon class="size-3.5 text-green-600" />
												{:else}
													<CopyIcon class="size-3.5" />
												{/if}
											</button>
										</span>
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
								<td class="px-3 py-1.5 whitespace-nowrap">
									{#if delivery}
										<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
											<span class="size-1.5 rounded-full bg-current shrink-0"></span>
											{delivery.label}
										</span>
									{:else}
										<span class="text-foreground/40">—</span>
									{/if}
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
					{@const delivery = deliveryStatusInfo(order)}
					<div class="flex items-stretch">
						{#if selectableStatuses.includes(data.status)}
							<div class="flex items-center pl-4 pr-1">
								<Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
							</div>
						{/if}
						<button
							class="flex-1 min-w-0 text-left p-4 hover:bg-muted/30 transition-colors active:bg-muted/40"
							onclick={() => goto(`/dispatcher/stores/${storeId}/orders/${order.id.split('/').pop()}`)}
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
									{#if delivery}
										<div class="mt-1">
											<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
												<span class="size-1.5 rounded-full bg-current shrink-0"></span>
												{delivery.label}
											</span>
										</div>
									{/if}
								</div>
								<span class="font-semibold text-foreground shrink-0">
									{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
								</span>
							</div>
						</button>
					</div>
				{/each}
			</div>
			{#if data.pageInfo.hasNextPage}
				<div class="p-3 border-t border-border">
					<Button variant="outline" class="w-full" disabled={loadingMore} onclick={nextPage}>
						{#if loadingMore}
							<Loader2Icon class="size-4 animate-spin" />
						{/if}
						{loadingMore ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
	{/if}
	</div>
</div>

<!-- Bulk confirm dialog -->
<Dialog.Root bind:open={showBulkConfirmDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Confirm {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''}?</Dialog.Title>
			<Dialog.Description>Marks these orders as confirmed with the customer. They can then be fulfilled.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/bulkConfirm"
			use:enhance={() => {
				bulkConfirming = true;
				return async ({ result, update }) => {
					await update();
					bulkConfirming = false;
					showBulkConfirmDialog = false;
					if (result.type === 'redirect') {
						selectedIds = new Set();
						addToast('Orders confirmed');
					} else {
						addToast('Failed to confirm orders', 'error');
					}
				};
			}}
		>
			<input type="hidden" name="ids" value={[...selectedIds].join(',')} />
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={bulkConfirming} onclick={() => showBulkConfirmDialog = false}>Cancel</Button>
				<Button type="submit" disabled={bulkConfirming}>
					{#if bulkConfirming}<Loader2Icon class="size-4 animate-spin" />{/if}
					{bulkConfirming ? 'Confirming…' : 'Confirm Orders'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
