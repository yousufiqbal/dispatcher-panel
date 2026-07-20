<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page, navigating } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { formatCurrency, formatDate, formatRelativeDate } from '$lib/utils';
	import { deliveryPill } from '$lib/delivery-status';
	import SearchIcon from '@lucide/svelte/icons/search';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.searchQ ?? '');
	let searchTimeout: ReturnType<typeof setTimeout>;

	let selectedIds = $state<Set<string>>(new Set());
	let copiedPhone = $state<string | null>(null);
	let copiedTracking = $state<string | null>(null);
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

	const selectableStatuses = ['pending', 'confirmed', 'incorrect-address', 'fulfilled', 'attempted', 'failed'];
	const INCORRECT_ADDRESS_TAG = 'incorrect-address';
	let showBulkConfirmDialog = $state(false);
	let bulkConfirming = $state(false);

	interface AddressCandidate {
		id: string;
		name: string;
		customerName: string;
		reasons: string[];
	}

	let showCheckAddressesModal = $state(false);
	let scanningAddresses = $state(false);
	let hasRunCheck = $state(false);
	let checkedCount = $state(0);
	let candidates = $state<AddressCandidate[]>([]);
	let selectedCandidateIds = $state<Set<string>>(new Set());
	let markingSelected = $state(false);

	function openCheckAddressesModal() {
		hasRunCheck = false;
		checkedCount = 0;
		candidates = [];
		selectedCandidateIds = new Set();
		showCheckAddressesModal = true;
	}

	function toggleCandidate(id: string) {
		const next = new Set(selectedCandidateIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedCandidateIds = next;
	}

	let showMergeDialog = $state(false);
	let mergeMainId = $state('');
	let merging = $state(false);

	const selectedOrders = $derived(data.orders.filter((o) => selectedIds.has(o.id)));
	// Merging only makes sense for 2+ orders placed by the same real customer
	// (guest orders have no customer to key off of).
	const mergeEligible = $derived(
		selectedOrders.length >= 2 &&
		!!selectedOrders[0].customer &&
		selectedOrders.every((o) => o.customer?.id === selectedOrders[0].customer?.id)
	);

	function openMergeDialog() {
		// Default to the oldest selected order as the main one — it's usually the
		// customer's original intent, with later orders being add-ons/duplicates.
		const oldest = [...selectedOrders].sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		)[0];
		mergeMainId = oldest?.id ?? '';
		showMergeDialog = true;
	}

	interface AddressEdit {
		firstName: string;
		lastName: string;
		phone: string;
		address1: string;
		address2: string;
		city: string;
		province: string;
		country: string;
		zip: string;
		incorrectAddress: boolean;
	}

	let showAddressCheckModal = $state(false);
	let addressEdits = $state<Record<string, AddressEdit>>({});
	let checkingAddresses = $state(false);

	function openAddressCheckModal() {
		const edits: Record<string, AddressEdit> = {};
		for (const o of selectedOrders) {
			const addr = o.shippingAddress;
			const [firstName, ...rest] = (addr?.name ?? '').split(' ');
			edits[o.id] = {
				firstName: firstName ?? '',
				lastName: rest.join(' '),
				phone: addr?.phone ?? o.customer?.phone ?? o.phone ?? '',
				address1: addr?.address1 ?? '',
				address2: addr?.address2 ?? '',
				city: addr?.city ?? '',
				province: addr?.province ?? '',
				country: addr?.country ?? '',
				zip: addr?.zip ?? '',
				incorrectAddress: o.tags.includes(INCORRECT_ADDRESS_TAG)
			};
		}
		addressEdits = edits;
		showAddressCheckModal = true;
	}

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

	$effect(() => {
		const autoChecked = $page.url.searchParams.get('autoChecked');
		if (autoChecked === null) return;
		addToast(`Auto-check flagged ${autoChecked} order${autoChecked === '1' ? '' : 's'} with an incorrect address`);
		const sp = new URLSearchParams($page.url.searchParams);
		sp.delete('autoChecked');
		goto(`?${sp}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	const tabs = [
		{ key: 'all', label: 'All' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'incorrect-address', label: 'Incorrect Address' },
		{ key: 'confirmed', label: 'Confirmed' },
		{ key: 'fulfilled', label: 'Fulfilled' },
		{ key: 'attempted', label: 'Attempted' },
		{ key: 'failed', label: 'Failed' },
		{ key: 'cancelled', label: 'Cancelled' },
		{ key: 'returned', label: 'Returned' }
	];

	function getStatusClass(financial: string, fulfillment: string): string {
		if (financial === 'VOIDED') return 'badge-cancelled';
		if (financial === 'REFUNDED') return 'badge-returned';
		if (fulfillment === 'FULFILLED') return 'badge-fulfilled';
		if (financial === 'PENDING') return 'badge-pending';
		if (fulfillment === 'UNFULFILLED') return 'badge-pending';
		return 'badge-partial';
	}

	function getStatusLabel(financial: string, fulfillment: string): string {
		if (financial === 'VOIDED') return 'Voided';
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
			// Search should look across all orders, not just the currently
			// selected status tab — reset to "all" whenever a search runs.
			navigate({ q: searchInput || null, status: null });
		}, 350);
	}

	function setStatus(key: string) {
		navigate({ status: key === 'all' ? null : key });
	}

	// Real href (not just an onclick+goto) so SvelteKit's hover-preload
	// (data-sveltekit-preload-data="hover" in app.html) actually kicks in.
	function tabHref(key: string): string {
		const sp = new URLSearchParams($page.url.searchParams);
		if (key === 'all') sp.delete('status');
		else sp.set('status', key);
		sp.delete('after');
		sp.delete('page');
		const qs = sp.toString();
		return qs ? `?${qs}` : '?';
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
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="icon" title="More">
							<MoreHorizontalIcon class="size-4" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-44">
					<DropdownMenu.Item onclick={() => setStatus('drafts')}>Drafts</DropdownMenu.Item>
					<DropdownMenu.Item onclick={openCheckAddressesModal}>
						<MapPinIcon class="size-3.5" />
						Check Addresses
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<!-- Status tabs -->
	<div class="mb-5 pb-1 flex items-center gap-2">
		<div class="overflow-x-auto overflow-y-hidden">
			<div class="inline-flex items-center gap-2 flex-nowrap">
				{#each tabs as tab}
					{@const isActive = (data.status ?? 'all') === tab.key}
					<a
						href={tabHref(tab.key)}
						onclick={() => selectedIds = new Set()}
						class="inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150
							{isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border border-zinc-200 text-muted-foreground hover:bg-accent'}"
					>
						{tab.label}
						{#if tab.key === 'pending'}
							<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold {data.pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'}">
								{data.pendingCount}
							</span>
						{/if}
						{#if tab.key === 'incorrect-address'}
							<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold {data.incorrectAddressCount > 0 ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500'}">
								{data.incorrectAddressCount}
							</span>
						{/if}
						{#if tab.key === 'confirmed'}
							<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold {data.confirmedCount > 0 ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-500'}">
								{data.confirmedCount}
							</span>
						{/if}
						{#if tab.key === 'attempted'}
							<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold {data.attemptedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'}">
								{data.attemptedCount}
							</span>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	</div>

	{#if data.status === 'pending' && selectedIds.size > 0}
		<div class="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<div class="flex items-center gap-2">
				{#if mergeEligible}
					<Button variant="outline" size="sm" onclick={openMergeDialog}>Merge Orders</Button>
				{/if}
				<Button size="sm" onclick={() => showBulkConfirmDialog = true}>Confirm Selected</Button>
			</div>
		</div>
	{/if}

	{#if data.status === 'incorrect-address' && selectedIds.size > 0}
		<div class="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" onclick={openAddressCheckModal}>
					<MapPinIcon class="size-4" />
					Check Addresses
				</Button>
			</div>
		</div>
	{/if}

	{#if data.status === 'confirmed' && selectedIds.size > 0}
		<div class="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<div class="flex items-center gap-2">
				{#if mergeEligible}
					<Button variant="outline" size="sm" onclick={openMergeDialog}>Merge Orders</Button>
				{/if}
				{#if selectedOrders.length >= 2}
					<Button variant="outline" size="sm" onclick={openAddressCheckModal}>
						<MapPinIcon class="size-4" />
						Check Addresses
					</Button>
				{/if}
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
							<th class="text-center px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Items</th>
							<th class="text-right px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Total</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Payment</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Fulfillment</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Destination</th>
							<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Delivery Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.orders as order}
							{@const delivery = deliveryStatusInfo(order)}
							{@const isCancelled = !!order.cancelledAt}
							<tr class="hover:bg-muted/40 transition-colors {isCancelled ? 'opacity-60 bg-muted/30' : ''}">
								{#if selectableStatuses.includes(data.status)}
									<td class="px-3 py-1.5">
										<Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
									</td>
								{/if}
								<td class="px-3 py-1.5 font-bold whitespace-nowrap {isCancelled ? 'line-through' : ''}">
									<a href="/dispatcher/stores/{storeId}/orders/{order.id.split('/').pop()}" class="text-foreground hover:text-primary hover:underline">{order.name}</a>
								</td>
								<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap {isCancelled ? 'line-through' : ''}">{formatRelativeDate(order.createdAt)}</td>
								<td class="px-3 py-1.5">
									{#if order.customer}
										<a
											href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}"
											target="_blank"
											rel="noopener"
											class="font-medium text-foreground hover:text-primary hover:underline {isCancelled ? 'line-through' : ''}"
										>{order.customer.displayName}</a>
									{:else}
										<div class="font-medium text-foreground {isCancelled ? 'line-through' : ''}">Guest</div>
									{/if}
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
								<td class="px-3 py-1.5 text-center text-foreground/70" onclick={(e) => e.stopPropagation()}>
									<Popover.Root>
										<Popover.Trigger>
											{#snippet child({ props })}
												<button type="button" {...props} class="inline-flex items-center gap-1 hover:text-primary rounded-md px-1.5 -mx-1.5 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:bg-primary/5 {isCancelled ? 'line-through' : ''}">
													{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)}
													<ChevronDownIcon class="size-3.5" />
												</button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-80 p-0 gap-0 overflow-hidden" align="center">
											<div class="divide-y divide-border overflow-y-auto" style="max-height: min(60vh, var(--bits-floating-available-height, 60vh));">
												{#each order.lineItems.nodes as item}
													{@const img = item.variant?.image ?? item.image}
													<div class="flex items-center gap-3 px-3 py-2.5">
														{#if img}
															<img src={img.url} alt={img.altText ?? item.title} class="size-10 rounded-md object-cover border border-border shrink-0" />
														{:else}
															<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
														{/if}
														<div class="min-w-0 flex-1">
															<div class="text-sm font-medium text-foreground leading-snug">{item.title}</div>
															{#if item.variant?.title && item.variant.title !== 'Default Title'}
																<span class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">{item.variant.title}</span>
															{/if}
														</div>
														<span class="text-sm text-muted-foreground shrink-0">×{item.quantity}</span>
													</div>
												{/each}
											</div>
										</Popover.Content>
									</Popover.Root>
								</td>
								<td class="px-3 py-1.5 text-right font-semibold text-foreground whitespace-nowrap {isCancelled ? 'line-through' : ''}">
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
									{#if isCancelled}
										<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
											<span class="size-1.5 rounded-full bg-current shrink-0"></span>
											Not required
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
											{order.displayFulfillmentStatus === 'FULFILLED' ? 'bg-green-100 text-green-800' :
											 order.displayFulfillmentStatus === 'UNFULFILLED' ? 'bg-amber-100 text-amber-800' :
											 'bg-zinc-100 text-zinc-700'}">
											<span class="size-1.5 rounded-full bg-current shrink-0"></span>
											{order.displayFulfillmentStatus.replace(/_/g,' ')}
										</span>
									{/if}
								</td>
								<td class="px-3 py-1.5 whitespace-nowrap {isCancelled ? 'line-through' : ''}">
									{#if order.shippingAddress}
										<div class="font-medium text-foreground">{order.shippingAddress.city}</div>
										<div class="text-xs text-foreground/60">{order.shippingAddress.country}</div>
									{:else}
										<span class="text-foreground/40">—</span>
									{/if}
								</td>
								<td class="px-3 py-1.5 whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
									{#if delivery}
										{@const tracking = order.fulfillments.flatMap((f) => f.trackingInfo).find((t) => t.number || t.company)}
										<Popover.Root>
											<Popover.Trigger>
												{#snippet child({ props })}
													<button type="button" {...props} class="inline-flex items-center gap-1 hover:opacity-80 rounded-md px-1 -mx-1 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:bg-primary/5">
														<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
															<span class="size-1.5 rounded-full bg-current shrink-0"></span>
															{delivery.label}
														</span>
														<ChevronDownIcon class="size-3.5 text-muted-foreground" />
													</button>
												{/snippet}
											</Popover.Trigger>
											<Popover.Content class="w-64 p-3" align="end">
												<div class="text-sm font-semibold mb-2">Delivery</div>
												{#if tracking}
													<div class="space-y-2 text-sm">
														<div>
															<div class="text-xs text-muted-foreground uppercase tracking-wide">Courier</div>
															<div class="font-medium text-foreground">{tracking.company ?? 'Unknown courier'}</div>
														</div>
														<div>
															<div class="text-xs text-muted-foreground uppercase tracking-wide">Tracking</div>
															<div class="flex items-center gap-1.5">
																{#if tracking.url}
																	<a href={tracking.url} target="_blank" rel="noopener" class="font-mono text-primary hover:underline">
																		{tracking.number ?? tracking.url}
																	</a>
																{:else}
																	<div class="font-mono text-foreground">{tracking.number ?? '—'}</div>
																{/if}
																{#if tracking.number}
																	<button
																		type="button"
																		class="text-muted-foreground hover:text-primary shrink-0"
																		title="Copy tracking number"
																		onclick={() => {
																			const num = tracking.number ?? '';
																			navigator.clipboard.writeText(num);
																			copiedTracking = num;
																			setTimeout(() => copiedTracking === num && (copiedTracking = null), 1200);
																		}}
																	>
																		{#if copiedTracking === tracking.number}
																			<CheckIcon class="size-3.5 text-green-600" />
																		{:else}
																			<CopyIcon class="size-3.5" />
																		{/if}
																	</button>
																{/if}
															</div>
														</div>
													</div>
												{:else}
													<p class="text-sm text-muted-foreground">No tracking information yet.</p>
												{/if}
											</Popover.Content>
										</Popover.Root>
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
					{@const isCancelled = !!order.cancelledAt}
					<div class="flex items-stretch {isCancelled ? 'opacity-60 bg-muted/30' : ''}">
						{#if selectableStatuses.includes(data.status)}
							<div class="flex items-center pl-4 pr-1">
								<Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
							</div>
						{/if}
						<div class="flex-1 min-w-0 p-4">
							<div class="flex items-start justify-between gap-2 mb-2">
								<a
									href="/dispatcher/stores/{storeId}/orders/{order.id.split('/').pop()}"
									class="font-bold text-foreground hover:text-primary hover:underline {isCancelled ? 'line-through' : ''}"
								>{order.name}</a>
								<span class="{getStatusClass(order.displayFinancialStatus, order.displayFulfillmentStatus)} shrink-0">
									{getStatusLabel(order.displayFinancialStatus, order.displayFulfillmentStatus)}
								</span>
							</div>
							<div class="flex items-end justify-between gap-2">
								<div>
									{#if order.customer}
										<a
											href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}"
											target="_blank"
											rel="noopener"
											class="text-sm text-muted-foreground hover:text-primary hover:underline {isCancelled ? 'line-through' : ''}"
										>{order.customer.displayName}</a>
									{:else}
										<div class="text-sm text-muted-foreground {isCancelled ? 'line-through' : ''}">Unknown</div>
									{/if}
									{#if order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}<div class="text-xs text-muted-foreground">{order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone}</div>{/if}
									<div class="text-xs text-muted-foreground mt-0.5 {isCancelled ? 'line-through' : ''}">
										{formatDate(order.createdAt)} · {order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)} item{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}
									</div>
									{#if isCancelled}
										<div class="mt-1">
											<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
												<span class="size-1.5 rounded-full bg-current shrink-0"></span>
												Not required
											</span>
										</div>
									{:else if delivery}
										<div class="mt-1">
											<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
												<span class="size-1.5 rounded-full bg-current shrink-0"></span>
												{delivery.label}
											</span>
										</div>
									{/if}
								</div>
								<span class="font-semibold text-foreground shrink-0 {isCancelled ? 'line-through' : ''}">
									{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
								</span>
							</div>
						</div>
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

<!-- Check addresses (scan pending orders) dialog -->
<Dialog.Root bind:open={showCheckAddressesModal}>
	<Dialog.Content class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Check Addresses</Dialog.Title>
			<Dialog.Description>
				Scans every Pending order for address issues (missing/short street address, unrecognized city, incomplete name, invalid phone). Nothing changes until you confirm which ones below are actually wrong.
			</Dialog.Description>
		</Dialog.Header>

		{#if !hasRunCheck}
			<form method="POST" action="?/checkAddresses" use:enhance={() => {
				scanningAddresses = true;
				return async ({ result }) => {
					scanningAddresses = false;
					if (result.type === 'success' && result.data) {
						checkedCount = (result.data.checked as number) ?? 0;
						candidates = (result.data.candidates as AddressCandidate[]) ?? [];
						selectedCandidateIds = new Set(candidates.map((c) => c.id));
						hasRunCheck = true;
					} else {
						addToast('Address check failed', 'error');
					}
				};
			}}>
				<Dialog.Footer>
					<Button type="button" variant="outline" disabled={scanningAddresses} onclick={() => showCheckAddressesModal = false}>Cancel</Button>
					<Button type="submit" disabled={scanningAddresses}>
						{#if scanningAddresses}<Loader2Icon class="size-4 animate-spin" />{/if}
						{scanningAddresses ? 'Scanning…' : 'Run Check'}
					</Button>
				</Dialog.Footer>
			</form>
		{:else if candidates.length === 0}
			<div class="py-6 text-center text-sm text-muted-foreground">
				Checked {checkedCount} pending order{checkedCount === 1 ? '' : 's'} — no address issues found.
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => showCheckAddressesModal = false}>Close</Button>
			</Dialog.Footer>
		{:else}
			<p class="text-xs text-muted-foreground">
				Checked {checkedCount} pending order{checkedCount === 1 ? '' : 's'}, flagged {candidates.length}. Uncheck any that are actually fine.
			</p>
			<div class="space-y-2 max-h-96 overflow-y-auto">
				{#each candidates as c}
					<label class="flex items-start gap-3 border border-border rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors {selectedCandidateIds.has(c.id) ? 'border-red-300 bg-red-50/50' : ''}">
						<Checkbox checked={selectedCandidateIds.has(c.id)} onCheckedChange={() => toggleCandidate(c.id)} class="mt-0.5" />
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between gap-2">
								<span class="font-semibold text-sm text-foreground">{c.name}</span>
								<span class="text-xs text-muted-foreground truncate">{c.customerName}</span>
							</div>
							<ul class="mt-1 text-xs text-red-700 list-disc list-inside space-y-0.5">
								{#each c.reasons as reason}
									<li>{reason}</li>
								{/each}
							</ul>
						</div>
					</label>
				{/each}
			</div>
			<form method="POST" action="?/markIncorrectSelected" use:enhance={() => {
				markingSelected = true;
				return async ({ result, update }) => {
					await update();
					markingSelected = false;
					if (result.type === 'redirect') {
						showCheckAddressesModal = false;
						addToast('Orders marked incorrect');
					} else {
						addToast('Failed to mark orders', 'error');
					}
				};
			}}>
				<input type="hidden" name="ids" value={[...selectedCandidateIds].join(',')} />
				<Dialog.Footer class="mt-4">
					<Button type="button" variant="outline" disabled={markingSelected} onclick={() => showCheckAddressesModal = false}>Cancel</Button>
					<Button type="submit" disabled={markingSelected || selectedCandidateIds.size === 0}>
						{#if markingSelected}<Loader2Icon class="size-4 animate-spin" />{/if}
						{markingSelected ? 'Marking…' : `Mark ${selectedCandidateIds.size} as Incorrect`}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Merge orders dialog -->
<Dialog.Root bind:open={showMergeDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Merge {selectedOrders.length} orders</Dialog.Title>
			<Dialog.Description>
				Choose which order all items should merge into. The other {selectedOrders.length - 1} order{selectedOrders.length - 1 === 1 ? '' : 's'} will be cancelled — this cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
			The orders you don't pick as the main order will be cancelled once their items are moved.
		</div>
		<form method="POST" action="?/mergeOrders" use:enhance={() => {
			merging = true;
			return async ({ result, update }) => {
				await update();
				merging = false;
				if (result.type === 'redirect') {
					selectedIds = new Set();
					addToast('Orders merged');
				} else {
					addToast('Failed to merge orders', 'error');
				}
			};
		}}>
			<input type="hidden" name="mainOrderId" value={mergeMainId} />
			<input type="hidden" name="otherOrderIds" value={selectedOrders.filter((o) => o.id !== mergeMainId).map((o) => o.id).join(',')} />

			<RadioGroup.Root bind:value={mergeMainId} class="gap-2">
				{#each [...selectedOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) as o}
					<label class="flex items-center gap-3 border border-border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors {mergeMainId === o.id ? 'border-primary/50 bg-primary/5' : ''}">
						<RadioGroup.Item value={o.id} />
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm text-foreground">{o.name}</div>
							<div class="text-xs text-muted-foreground">
								{o.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)} items · {formatCurrency(o.totalPriceSet.shopMoney.amount, o.totalPriceSet.shopMoney.currencyCode)}
							</div>
						</div>
						{#if mergeMainId === o.id}
							<span class="text-xs font-semibold text-primary shrink-0">Main order</span>
						{/if}
					</label>
				{/each}
			</RadioGroup.Root>

			<Dialog.Footer class="mt-4">
				<Button type="button" variant="outline" disabled={merging} onclick={() => showMergeDialog = false}>Cancel</Button>
				<Button type="submit" variant="destructive" disabled={merging || !mergeMainId}>
					{#if merging}<Loader2Icon class="size-4 animate-spin" />{/if}
					{merging ? 'Merging…' : 'Merge & Cancel Others'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Check addresses dialog -->
<Dialog.Root bind:open={showAddressCheckModal}>
	<Dialog.Content class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Check addresses — {selectedOrders.length} orders</Dialog.Title>
			<Dialog.Description>Review and fix any incorrect customer name, phone, or address before booking.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/bulkUpdateAddresses" use:enhance={() => {
			checkingAddresses = true;
			return async ({ result, update }) => {
				await update();
				checkingAddresses = false;
				if (result.type === 'redirect') {
					addToast('Addresses updated');
					showAddressCheckModal = false;
				} else {
					addToast('Failed to update addresses', 'error');
				}
			};
		}} class="space-y-4">
			<input type="hidden" name="orderIds" value={selectedOrders.map((o) => o.id).join(',')} />
			<input type="hidden" name="returnStatus" value={data.status} />
			{#each selectedOrders as o}
				{@const e = addressEdits[o.id]}
				{#if e}
					<div class="card p-4 space-y-3 {e.incorrectAddress ? 'border-red-500' : ''}">
						<div class="flex items-center justify-between gap-2">
							<div class="font-semibold text-sm text-foreground">{o.name}</div>
							<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
								<Checkbox bind:checked={e.incorrectAddress} name="incorrectAddress_{o.id}" />
								Mark address as incorrect
							</label>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1.5">
								<Label class="text-xs">First Name</Label>
								<Input name="firstName_{o.id}" bind:value={e.firstName} />
							</div>
							<div class="space-y-1.5">
								<Label class="text-xs">Last Name</Label>
								<Input name="lastName_{o.id}" bind:value={e.lastName} />
							</div>
							<div class="space-y-1.5 col-span-2">
								<Label class="text-xs">Phone</Label>
								<Input name="phone_{o.id}" bind:value={e.phone} />
							</div>
							<div class="space-y-1.5 col-span-2">
								<Label class="text-xs">Address</Label>
								<Textarea name="address1_{o.id}" bind:value={e.address1} rows={2} class="resize-none" />
							</div>
						</div>
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
							<div class="space-y-1.5">
								<Label class="text-xs">City</Label>
								<Input name="city_{o.id}" bind:value={e.city} />
							</div>
							<div class="space-y-1.5">
								<Label class="text-xs">ZIP</Label>
								<Input name="zip_{o.id}" bind:value={e.zip} />
							</div>
							<div class="space-y-1.5">
								<Label class="text-xs">Province</Label>
								<Input name="province_{o.id}" bind:value={e.province} />
							</div>
							<div class="space-y-1.5">
								<Label class="text-xs">Country</Label>
								<Input name="country_{o.id}" bind:value={e.country} />
							</div>
						</div>
					</div>
				{/if}
			{/each}
			<Dialog.Footer class="sm:justify-between items-center">
				{@const markedCount = Object.values(addressEdits).filter((e) => e.incorrectAddress).length}
				<span class="text-xs text-muted-foreground {markedCount > 0 ? 'text-red-600 font-medium' : ''}">
					{markedCount} of {selectedOrders.length} marked incorrect
				</span>
				<div class="flex items-center gap-2">
					<Button type="button" variant="outline" disabled={checkingAddresses} onclick={() => showAddressCheckModal = false}>Cancel</Button>
					<Button type="submit" disabled={checkingAddresses}>
						{#if checkingAddresses}<Loader2Icon class="size-4 animate-spin" />{/if}
						{checkingAddresses ? 'Saving…' : 'Save Addresses'}
					</Button>
				</div>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
