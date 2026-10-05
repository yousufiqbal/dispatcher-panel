<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import ContactActions from '$lib/components/ContactActions.svelte';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { deliveryPill } from '$lib/delivery-status';
	import {
		LATE_AFTER_BUSINESS_DAYS,
		STALE_TRACKING_AFTER_BUSINESS_DAYS,
		TRACKER_WINDOWS,
		isStaleTracking,
		type TrackerRow,
		type TrackerTab
	} from '$lib/tracker';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const storeId = $derived($page.params.storeId);
	const PAGE_SIZE = 50;

	const TABS: { key: TrackerTab; label: string }[] = [
		{ key: 'tracking', label: 'Tracking Only' },
		{ key: 'transit', label: 'In Transit' },
		{ key: 'out', label: 'Out for Delivery' },
		{ key: 'attempted', label: 'Attempted' },
		{ key: 'late', label: 'Late' }
	];

	// Tab lives in the URL (shallow, no reload) so a refresh lands back on it.
	const initialTab = $page.url.searchParams.get('tab');
	let tab = $state<TrackerTab>(TABS.find((t) => t.key === initialTab)?.key ?? 'tracking');
	let search = $state('');
	let pageIndex = $state(0);

	// By dispatch date. Kept in the URL (shallow) like the tab, so a refresh
	// keeps it; the server returns oldest-first, so "latest" just reverses.
	type Sort = 'latest' | 'oldest';
	let sort = $state<Sort>($page.url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest');

	function setSort(next: Sort) {
		if (next === sort) return;
		sort = next;
		pageIndex = 0;
		const url = new URL($page.url);
		if (next === 'latest') url.searchParams.delete('sort');
		else url.searchParams.set('sort', next);
		replaceState(url, {});
	}
	let refreshing = $state(false);

	function setTab(next: TrackerTab) {
		if (next === tab) return;
		tab = next;
		pageIndex = 0;
		const url = new URL($page.url);
		if (next === 'tracking') url.searchParams.delete('tab');
		else url.searchParams.set('tab', next);
		replaceState(url, {});
	}

	// Changing the window refetches (it changes what's loaded from Shopify).
	function setDays(days: number) {
		const url = new URL($page.url);
		url.searchParams.set('days', String(days));
		goto(url, { keepFocus: true, noScroll: true });
	}

	// The four stage tabs don't overlap. Late overlaps them all on purpose: a
	// late parcel is still in one of the stages.
	const inTab = (r: TrackerRow, t: TrackerTab): boolean => (t === 'late' ? r.late : r.stage === t);

	const counts = $derived({
		tracking: data.orders.filter((r) => inTab(r, 'tracking')).length,
		transit: data.orders.filter((r) => inTab(r, 'transit')).length,
		out: data.orders.filter((r) => inTab(r, 'out')).length,
		attempted: data.orders.filter((r) => inTab(r, 'attempted')).length,
		late: data.orders.filter((r) => inTab(r, 'late')).length
	});

	function digits(s: string): string {
		const d = s.replace(/\D/g, '');
		if (d.startsWith('92')) return d.slice(2);
		if (d.startsWith('0')) return d.slice(1);
		return d;
	}

	function matches(r: TrackerRow, q: string): boolean {
		const text = q.trim().toLowerCase();
		if (!text) return true;
		const hay = [r.name, r.customer, r.address, r.courier, r.trackingNumber].join(' ').toLowerCase();
		if (hay.includes(text) || r.name.replace('#', '').includes(text.replace('#', ''))) return true;
		const d = digits(text);
		return d.length >= 4 && digits(r.phone).includes(d);
	}

	const filtered = $derived.by(() => {
		const rows = data.orders.filter((r) => inTab(r, tab) && matches(r, search));
		return sort === 'latest' ? rows.reverse() : rows;
	});
	const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const pageRows = $derived(filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE));

	$effect(() => {
		if (pageIndex > pageCount - 1) pageIndex = pageCount - 1;
	});

	// After a courier booking the redirect lands here with ?labels=<orderIds>
	// (the Orders list used to do this before it was hidden): download the
	// airway bills for the just-booked orders, then drop the params so a
	// refresh doesn't download again.
	$effect(() => {
		const labelIds = $page.url.searchParams.get('labels');
		if (!labelIds) return;
		const booked = Number($page.url.searchParams.get('booked'));
		if (booked > 0) addToast(`Booked ${booked} order${booked === 1 ? '' : 's'} — downloading labels`);
		const a = document.createElement('a');
		a.href = `/dispatcher/stores/${storeId}/orders/labels?ids=${labelIds}&download=1`;
		// `download` stops SvelteKit's router treating it as a page navigation
		// (which would hang — the endpoint streams a PDF, not a page).
		a.download = '';
		document.body.appendChild(a);
		a.click();
		a.remove();
		const url = new URL($page.url);
		url.searchParams.delete('labels');
		url.searchParams.delete('booked');
		replaceState(url, {});
	});

	async function refresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
	}

	const loadingWindow = $derived(!!$navigating && $navigating.to?.url.pathname === $page.url.pathname);
</script>

<svelte:head>
	<title>Tracker — {data.currentStore?.name ?? 'Store'}</title>
</svelte:head>

<div class="p-3 sm:p-6 space-y-4">
	<div class="flex flex-wrap items-center gap-2">
		<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
			{#each TABS as t (t.key)}
				<button
					type="button"
					onclick={() => setTab(t.key)}
					class="px-3 py-1.5 rounded-md font-medium transition-colors tabular-nums {tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					{t.label}
					<span class="opacity-70">({counts[t.key]})</span>
				</button>
			{/each}
		</div>

		<div class="ml-auto flex flex-wrap items-center gap-2">
			<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs" role="group" aria-label="Sort by dispatch date">
				{#each [['latest', 'Latest'], ['oldest', 'Oldest']] as [key, label] (key)}
					<button
						type="button"
						onclick={() => setSort(key as Sort)}
						class="px-2.5 py-1.5 rounded-md font-medium transition-colors {sort === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
					>
						{label}
					</button>
				{/each}
			</div>
			<span class="text-xs text-muted-foreground hidden sm:inline">Dispatched within</span>
			<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
				{#each TRACKER_WINDOWS as d (d)}
					<button
						type="button"
						onclick={() => setDays(d)}
						class="px-2.5 py-1.5 rounded-md font-medium transition-colors {data.days === d ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
					>
						{d}d
					</button>
				{/each}
				<!-- A custom window from the URL shows as its own selected chip, so it's
				     clear the list isn't one of the presets. -->
				{#if !(TRACKER_WINDOWS as readonly number[]).includes(data.days)}
					<span class="px-2.5 py-1.5 rounded-md font-medium bg-card text-foreground shadow-sm">{data.days}d</span>
				{/if}
			</div>
			<Button variant="outline" size="sm" onclick={refresh} disabled={refreshing || loadingWindow}>
				{#if loadingWindow}
					<Loader2Icon class="size-3.5 animate-spin" />
				{:else}
					<RefreshCwIcon class="size-3.5 {refreshing ? 'animate-spin' : ''}" />
				{/if}
				Refresh
			</Button>
		</div>
	</div>

	{#if tab === 'tracking'}
		<p class="text-xs text-muted-foreground">
			Has a tracking number, but the courier hasn't reported any movement yet. Red: no movement {STALE_TRACKING_AFTER_BUSINESS_DAYS}+ business day{STALE_TRACKING_AFTER_BUSINESS_DAYS === 1 ? '' : 's'} after dispatch.
		</p>
	{:else if tab === 'late'}
		<p class="text-xs text-muted-foreground">
			Not delivered {LATE_AFTER_BUSINESS_DAYS}+ business days after dispatch (Saturdays and Sundays don't count). Includes orders that are also in transit or attempted.
		</p>
	{/if}

	<div class="card overflow-hidden {loadingWindow ? 'opacity-60' : ''}">
		<div class="px-3 py-2.5 border-b border-border">
			<div class="relative">
				<SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
				<Input
					bind:value={search}
					oninput={() => (pageIndex = 0)}
					placeholder="Search by order number, name, phone, address or tracking number"
					class="pl-8 h-9"
				/>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
						<th class="px-3 py-2 font-medium">Order</th>
						<th class="px-3 py-2 font-medium">Customer</th>
						<th class="px-3 py-2 font-medium">Dispatched</th>
						<th class="px-3 py-2 font-medium">Address</th>
						<th class="px-3 py-2 font-medium">Phone</th>
						<th class="px-3 py-2 font-medium">Contact</th>
						<th class="px-3 py-2 font-medium">City</th>
						<th class="px-3 py-2 font-medium">Tracking</th>
						<th class="px-3 py-2 font-medium">Status</th>
						<th class="px-3 py-2 font-medium text-right">Total</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each pageRows as r (r.id)}
						{@const pill = deliveryPill(r.displayStatus, !!r.trackingNumber)}
						<tr class="hover:bg-muted/20">
							<td class="px-3 py-2 whitespace-nowrap">
								<a href="/dispatcher/stores/{storeId}/orders/{r.legacyId}" class="font-semibold text-foreground hover:text-primary hover:underline">{r.name}</a>
							</td>
							<td class="px-3 py-2 whitespace-nowrap">{r.customer}</td>
							<td class="px-3 py-2 whitespace-nowrap">
								<div class="text-xs text-muted-foreground">{r.dispatchedLabel}</div>
								<div class="text-xs font-semibold {r.late || isStaleTracking(r) ? 'text-red-600' : 'text-foreground'}">
									{r.businessDays} business day{r.businessDays === 1 ? '' : 's'}
								</div>
							</td>
							<td class="px-3 py-2 max-w-[16rem]">
								<!-- Truncated to one line; the full address shows on hover. -->
								<div class="truncate text-muted-foreground" title={r.address}>{r.street || '—'}</div>
							</td>
							<td class="px-3 py-2 whitespace-nowrap font-mono text-xs">
								{#if r.phone}{r.phone}{:else}<span class="text-muted-foreground font-sans">No phone</span>{/if}
							</td>
							<td class="px-3 py-2"><ContactActions phone={r.phone} phoneDigits={r.phoneDigits} name={r.customer} /></td>
							<td class="px-3 py-2 whitespace-nowrap">{r.city || '—'}</td>
							<td class="px-3 py-2 whitespace-nowrap">
								<div class="text-xs text-muted-foreground">{r.courier || 'Courier'}</div>
								{#if r.trackingUrl}
									<a href={r.trackingUrl} target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
										{r.trackingNumber}<ExternalLinkIcon class="size-3" />
									</a>
								{:else}
									<span class="font-mono text-xs">{r.trackingNumber}</span>
								{/if}
							</td>
							<td class="px-3 py-2">
								{#if pill}
									<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap {pill.class}">
										<span class="size-1.5 rounded-full bg-current shrink-0"></span>{pill.label}
									</span>
								{/if}
							</td>
							<td class="px-3 py-2 whitespace-nowrap text-right font-semibold tabular-nums">{r.total}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if pageRows.length === 0}
			<div class="px-4 py-10 text-center text-sm text-muted-foreground">
				{#if search}
					No orders match your search.
				{:else if tab === 'late'}
					Nothing late. Every parcel is within {LATE_AFTER_BUSINESS_DAYS} business days.
				{:else if tab === 'attempted'}
					No attempted deliveries.
				{:else if tab === 'out'}
					Nothing out for delivery right now.
				{:else if tab === 'tracking'}
					Every tracked parcel has a courier update.
				{:else}
					Nothing in transit from the last {data.days} days.
				{/if}
			</div>
		{/if}

		{#if pageCount > 1}
			<div class="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-border text-sm">
				<span class="text-muted-foreground tabular-nums">
					{pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
				</span>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" disabled={pageIndex === 0} onclick={() => pageIndex--}>← Previous</Button>
					<Button variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onclick={() => pageIndex++}>Next →</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
