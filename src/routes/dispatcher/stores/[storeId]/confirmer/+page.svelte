<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ContactActions from '$lib/components/ContactActions.svelte';
	import {
		PK_PROVINCES,
		BETWEEN_REASONS,
		BETWEEN_OTHER_TAG,
		BETWEEN_NOTE_MAX,
		betweenLabel,
		humanizeEnum,
		financialBadge,
		fulfillmentBadge,
		type AddressFields,
		type EasyConfirmRow,
		type EasyConfirmTab,
		type EasyConfirmView
	} from '$lib/easy-confirm';
	import { TRACKER_WINDOWS } from '$lib/tracker';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const storeId = $derived($page.params.storeId);
	const PAGE_SIZE = 50;

	// ---- Tab / search / paging ---------------------------------------------
	// Tab lives in the URL (shallow, no reload) so a refresh lands back on it.
	const TABS: { key: EasyConfirmView; label: string }[] = [
		{ key: 'pending', label: 'Pending' },
		{ key: 'between', label: 'Between' },
		{ key: 'confirmed', label: 'Confirmed' },
		{ key: 'fulfilled', label: 'Fulfilled' }
	];
	const initialTab = $page.url.searchParams.get('tab');
	let tab = $state<EasyConfirmView>(TABS.find((t) => t.key === initialTab)?.key ?? 'pending');
	// Fulfilled is read-only: already shipped, nothing to confirm or edit.
	const readOnly = $derived(tab === 'fulfilled');
	let search = $state('');
	let pageIndex = $state(0);

	// By order date. Kept in the URL (shallow) like the tab, so a refresh keeps
	// it; the server returns newest-first, so "oldest" just reverses.
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

	// Changing the window refetches (it changes what's loaded from Shopify).
	function setDays(days: number) {
		const url = new URL($page.url);
		url.searchParams.set('days', String(days));
		goto(url, { keepFocus: true, noScroll: true });
	}
	const loadingWindow = $derived(!!$navigating && $navigating.to?.url.pathname === $page.url.pathname);

	function setTab(next: EasyConfirmView) {
		if (next === tab) return;
		tab = next;
		pageIndex = 0;
		selected = new Set();
		const url = new URL($page.url);
		if (next === 'pending') url.searchParams.delete('tab');
		else url.searchParams.set('tab', next);
		replaceState(url, {});
	}

	// ---- Optimistic moves --------------------------------------------------
	// A confirmed order moves tabs the moment Shopify accepts the tag, before the
	// list reloads. Overrides are dropped whenever fresh data arrives — the
	// reload reads live tags, so it already agrees.
	type Override = Pick<EasyConfirmRow, 'state' | 'betweenTags' | 'betweenNote'>;
	let overrides = $state<Map<string, Override>>(new Map());
	let lastData: PageData['orders'] | null = null;
	$effect.pre(() => {
		if (data.orders !== lastData) {
			lastData = data.orders;
			overrides = new Map();
		}
	});

	const rows = $derived(data.orders.map((o) => (overrides.has(o.id) ? { ...o, ...overrides.get(o.id)! } : o)));
	const counts = $derived({
		pending: rows.filter((r) => r.state === 'pending').length,
		between: rows.filter((r) => r.state === 'between').length,
		confirmed: rows.filter((r) => r.state === 'confirmed').length,
		fulfilled: rows.filter((r) => r.state === 'fulfilled').length
	});

	// Search runs locally over the loaded orders — instant, no round trip.
	// Phone matches ignore formatting and the 0 / 92 prefix.
	function nationalDigits(s: string): string {
		const d = s.replace(/\D/g, '');
		if (d.startsWith('92')) return d.slice(2);
		if (d.startsWith('0')) return d.slice(1);
		return d;
	}

	function matches(r: EasyConfirmRow, q: string): boolean {
		const text = q.trim().toLowerCase();
		if (!text) return true;
		const hay = [r.name, r.customer, r.shipTo, r.email].join(' ').toLowerCase();
		if (hay.includes(text) || r.name.replace('#', '').includes(text.replace('#', ''))) return true;
		const digits = nationalDigits(text);
		return digits.length >= 4 && nationalDigits(r.phone).includes(digits);
	}

	const tabRows = $derived(rows.filter((r) => r.state === tab));
	const filtered = $derived.by(() => {
		const list = tabRows.filter((r) => matches(r, search));
		return sort === 'oldest' ? list.reverse() : list;
	});
	const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const pageRows = $derived(filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE));

	$effect(() => {
		// Typing a search or a row leaving the tab can shrink the list under the
		// current page — pull back to the last page that exists.
		if (pageIndex > pageCount - 1) pageIndex = pageCount - 1;
	});

	// ---- Selection -----------------------------------------------------------
	let selected = $state<Set<string>>(new Set());
	// Only rows on the current page count, so moved/hidden rows drop out.
	const selectedRows = $derived(pageRows.filter((r) => selected.has(r.id)));
	const allSelected = $derived(pageRows.length > 0 && selectedRows.length === pageRows.length);
	const someSelected = $derived(selectedRows.length > 0 && !allSelected);

	function toggleRow(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleAll() {
		selected = allSelected ? new Set() : new Set(pageRows.map((r) => r.id));
	}

	// ---- Merge ---------------------------------------------------------------
	// Same rule as the Orders page: 2+ orders from the same real customer.
	// Guest checkouts have no customer to match on, so they can't be merged.
	const mergeEligible = $derived(
		selectedRows.length >= 2 &&
			!!selectedRows[0].customerId &&
			selectedRows.every((r) => r.customerId === selectedRows[0].customerId)
	);
	let mergeOrders = $state<EasyConfirmRow[] | null>(null);
	let mergeMainId = $state('');
	let merging = $state(false);

	function openMerge() {
		// Oldest first, and it's the default main order — usually the customer's
		// original order, with later ones being add-ons or duplicates.
		const sorted = [...selectedRows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		mergeOrders = sorted;
		mergeMainId = sorted[0]?.id ?? '';
	}

	async function submitMerge() {
		if (!mergeOrders || !mergeMainId || merging) return;
		merging = true;
		const main = mergeOrders.find((o) => o.id === mergeMainId);
		const fd = new FormData();
		fd.set('mainId', mergeMainId);
		for (const o of mergeOrders) if (o.id !== mergeMainId) fd.append('otherId', o.id);

		try {
			const result = await postAction('merge', fd);
			if (result.type !== 'success') {
				const msg = result.type === 'failure' ? (result.data?.error as string) : null;
				addToast(msg || 'Failed to merge orders', 'error');
				return;
			}
			const merged = (result.data?.merged as string[]) ?? [];
			const failedCancels = (result.data?.failedCancels as string[]) ?? [];
			addToast(`Merged ${merged.join(', ')} into ${main?.name ?? 'the main order'}`);
			// The merge is done and can't be undone, but these are still live —
			// left alone they could be shipped a second time.
			if (failedCancels.length > 0) {
				addToast(`Couldn't cancel ${failedCancels.join(', ')} — cancel ${failedCancels.length === 1 ? 'it' : 'them'} manually to avoid shipping twice`, 'error');
			}
			mergeOrders = null;
			selected = new Set();
			invalidateAll();
		} catch {
			addToast('Network error — check the orders in Shopify before retrying', 'error');
		} finally {
			merging = false;
		}
	}

	// ---- Moving between states ------------------------------------------------
	// Confirm and back-to-pending go through a quick confirmation; Between goes
	// through the reason picker instead.
	type Move = { to: 'confirmed' | 'pending'; orders: EasyConfirmRow[] };
	let pendingMove = $state<Move | null>(null);
	let submitting = $state(false);
	let refreshing = $state(false);

	function askMove(to: Move['to'], orders: EasyConfirmRow[]) {
		if (orders.length > 0) pendingMove = { to, orders };
	}

	const moveHeading = $derived.by(() => {
		if (!pendingMove) return '';
		const n = pendingMove.orders.length;
		const first = pendingMove.orders[0]?.name;
		if (pendingMove.to === 'confirmed') return n === 1 ? `Confirm order ${first}?` : `Confirm ${n} orders?`;
		return n === 1 ? `Move order ${first} back to pending?` : `Move ${n} orders back to pending?`;
	});

	// Between: one reason per order, picked from pills. "Other" needs text.
	let betweenOrders = $state<EasyConfirmRow[] | null>(null);
	let betweenReason = $state<string>('');
	let betweenNote = $state('');
	let betweenTried = $state(false);
	const betweenValid = $derived(
		!!betweenReason && (betweenReason !== BETWEEN_OTHER_TAG || betweenNote.trim().length > 0)
	);

	function askBetween(orders: EasyConfirmRow[]) {
		if (orders.length === 0) return;
		betweenOrders = orders;
		betweenReason = '';
		betweenNote = '';
		betweenTried = false;
	}

	async function postAction(name: string, fd: FormData) {
		const res = await fetch(`?/${name}`, {
			method: 'POST',
			body: fd,
			headers: { 'x-sveltekit-action': 'true' }
		});
		return deserialize(await res.text());
	}

	// Sends the move, applies it optimistically to the rows that succeeded,
	// then reloads in the background (the reload reads live tags, so it agrees).
	async function runMove(to: EasyConfirmTab, orders: EasyConfirmRow[], reason = '', note = ''): Promise<boolean> {
		submitting = true;
		const fd = new FormData();
		fd.set('to', to);
		if (reason) fd.set('reason', reason);
		if (note) fd.set('note', note);
		for (const o of orders) fd.append('id', o.id);

		try {
			const result = await postAction('move', fd);
			if (result.type !== 'success') {
				const msg = result.type === 'failure' ? (result.data?.error as string) : null;
				addToast(msg || 'Something went wrong', 'error');
				return false;
			}
			const failed = new Set((result.data?.failed as string[]) ?? []);
			const done = orders.filter((o) => !failed.has(o.id));

			const next = new Map(overrides);
			for (const o of done) {
				next.set(o.id, {
					state: to,
					betweenTags: to === 'between' ? [reason] : [],
					betweenNote: to === 'between' && reason === BETWEEN_OTHER_TAG ? note.trim() : ''
				});
			}
			overrides = next;
			selected = new Set();

			const noun = done.length === 1 ? 'order' : 'orders';
			if (done.length > 0) {
				addToast(
					to === 'confirmed'
						? `${done.length} ${noun} confirmed`
						: to === 'between'
							? `${done.length} ${noun} moved to Between`
							: `${done.length} ${noun} moved back to pending`
				);
			}
			if (failed.size > 0) addToast(`${failed.size} of ${orders.length} orders couldn't be updated`, 'error');
			invalidateAll();
			return true;
		} catch {
			addToast('Network error — nothing was changed', 'error');
			return false;
		} finally {
			submitting = false;
		}
	}

	async function submitMove() {
		if (!pendingMove || submitting) return;
		if (await runMove(pendingMove.to, pendingMove.orders)) pendingMove = null;
	}

	async function submitBetween() {
		betweenTried = true;
		if (!betweenOrders || submitting || !betweenValid) return;
		if (await runMove('between', betweenOrders, betweenReason, betweenNote)) betweenOrders = null;
	}

	async function refresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
	}

	// ---- Address edit --------------------------------------------------------
	let addressTarget = $state<{ order: EasyConfirmRow; fields: AddressFields } | null>(null);
	let addressErrors = $state(false);
	let savingAddress = $state(false);

	function openAddress(r: EasyConfirmRow) {
		addressErrors = false;
		addressTarget = {
			order: r,
			fields: r.shipping
				? { ...r.shipping }
				: {
						firstName: '',
						lastName: '',
						company: '',
						address1: '',
						address2: '',
						city: '',
						provinceCode: '',
						zip: '',
						countryCode: 'PK',
						country: 'Pakistan',
						phone: r.phone
					}
		};
	}

	async function saveAddress() {
		if (!addressTarget || savingAddress) return;
		const f = addressTarget.fields;
		if (!f.address1.trim() || !f.city.trim()) {
			addressErrors = true;
			return;
		}
		savingAddress = true;
		const fd = new FormData();
		fd.set('id', addressTarget.order.id);
		fd.set('address', JSON.stringify(f));
		try {
			const result = await postAction('address', fd);
			if (result.type === 'success') {
				addToast(`Address updated for ${addressTarget.order.name}`);
				addressTarget = null;
				invalidateAll();
			} else {
				const msg = result.type === 'failure' ? (result.data?.error as string) : null;
				addToast(msg || "Couldn't update address", 'error');
			}
		} catch {
			addToast('Network error — address not saved', 'error');
		} finally {
			savingAddress = false;
		}
	}
</script>

<svelte:head>
	<title>Confirmer — {data.currentStore?.name ?? 'Store'}</title>
</svelte:head>

<div class="p-3 sm:p-6 space-y-4">
	<!-- Tabs + refresh -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
			{#each TABS as t (t.key)}
				<button
					type="button"
					onclick={() => setTab(t.key)}
					class="px-3 py-1.5 rounded-md font-medium transition-colors tabular-nums {tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					{t.label} <span class="opacity-70">({counts[t.key]})</span>
				</button>
			{/each}
		</div>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs" role="group" aria-label="Sort by order date">
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
			<span class="text-xs text-muted-foreground hidden sm:inline">Ordered within</span>
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
				<!-- A custom window from the URL shows as its own selected chip. -->
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
			<Button size="sm" href="/dispatcher/stores/{storeId}/orders/new">
				<PlusIcon class="size-3.5" />
				New Order
			</Button>
		</div>
	</div>

	<div class="card overflow-hidden {loadingWindow ? 'opacity-60' : ''}">
		<!-- Search, or the bulk bar while rows are selected -->
		<div class="px-3 py-2.5 border-b border-border min-h-[3.25rem] flex items-center">
			{#if selectedRows.length > 0}
				<div class="flex flex-wrap items-center gap-3">
					<span class="text-sm font-medium">{selectedRows.length} selected</span>
					{#if tab === 'confirmed'}
						<Button size="sm" variant="outline" onclick={() => askMove('pending', selectedRows)}>Move selected to pending</Button>
					{:else}
						<Button size="sm" onclick={() => askMove('confirmed', selectedRows)}>Confirm selected</Button>
						{#if tab === 'pending'}
							<Button size="sm" variant="outline" onclick={() => askBetween(selectedRows)}>Move to Between</Button>
						{:else}
							<Button size="sm" variant="outline" onclick={() => askMove('pending', selectedRows)}>Back to pending</Button>
						{/if}
					{/if}
					{#if mergeEligible}
						<Button size="sm" variant="outline" onclick={openMerge}>Merge orders</Button>
					{/if}
					<Button size="sm" variant="ghost" onclick={() => (selected = new Set())}>Clear</Button>
				</div>
			{:else}
				<div class="relative w-full">
					<SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
					<Input
						bind:value={search}
						oninput={() => (pageIndex = 0)}
						placeholder="Search by order number, name, phone or email"
						class="pl-8 h-9"
					/>
				</div>
			{/if}
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
						{#if !readOnly}
							<th class="px-3 py-2 w-8">
								<Checkbox
									checked={allSelected}
									indeterminate={someSelected}
									onCheckedChange={toggleAll}
									aria-label="Select all orders on this page"
								/>
							</th>
						{/if}
						<th class="px-3 py-2 font-medium">Order</th>
						{#if tab === 'between'}<th class="px-3 py-2 font-medium">Reason</th>{/if}
						<th class="px-3 py-2 font-medium">Date</th>
						<th class="px-3 py-2 font-medium">Customer</th>
						<th class="px-3 py-2 font-medium">Phone</th>
						<th class="px-3 py-2 font-medium">Contact</th>
						<th class="px-3 py-2 font-medium">Address</th>
						<th class="px-3 py-2 font-medium text-right">Total</th>
						<th class="px-3 py-2 font-medium">Payment</th>
						{#if readOnly}<th class="px-3 py-2 font-medium">Fulfillment</th>{/if}
						<th class="px-3 py-2 font-medium">Items</th>
						{#if !readOnly}<th class="px-3 py-2 font-medium">Action</th>{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each pageRows as r (r.id)}
						<tr class="hover:bg-muted/20 {selected.has(r.id) ? 'bg-primary/5' : ''}">
							{#if !readOnly}
								<td class="px-3 py-2">
									<Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} aria-label="Select order {r.name}" />
								</td>
							{/if}
							<td class="px-3 py-2 whitespace-nowrap">
								<a href="/dispatcher/stores/{storeId}/orders/{r.legacyId}" class="font-semibold text-foreground hover:text-primary hover:underline">{r.name}</a>
							</td>
							{#if tab === 'between'}
								<td class="px-3 py-2">
									<div class="flex flex-wrap items-center gap-1 max-w-[16rem]">
										{#each r.betweenTags as t (t)}
											<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 text-amber-800">{betweenLabel(t)}</span>
										{/each}
										{#if r.betweenNote}
											<span class="text-xs text-muted-foreground truncate" title={r.betweenNote}>{r.betweenNote}</span>
										{/if}
									</div>
								</td>
							{/if}
							<td class="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.date}</td>
							<td class="px-3 py-2 whitespace-nowrap">{r.customer}</td>
							<td class="px-3 py-2 whitespace-nowrap font-mono text-xs">
								{#if r.phone}{r.phone}{:else}<span class="text-muted-foreground font-sans">No phone</span>{/if}
							</td>
							<td class="px-3 py-2">
								<ContactActions phone={r.phone} phoneDigits={r.phoneDigits} name={r.customer} />
							</td>
							<!-- max-w-0 + w-full: the address column takes whatever width is
							     left and truncates instead of pushing the table into a
							     horizontal scroll; min-w keeps it readable on narrow screens. -->
							<td class="px-3 py-2 max-w-0 w-full">
								<div class="flex items-center gap-1.5 min-w-48">
									{#if r.address}
										{@const shipToPrefix = r.shipTo && r.shipTo !== r.customer ? `${r.shipTo} · ` : ''}
										<span class="truncate min-w-0" title="{shipToPrefix}{r.address}">
											{#if shipToPrefix}<strong>{shipToPrefix}</strong>{/if}{r.address}
										</span>
									{:else}
										<span class="text-muted-foreground">No shipping address</span>
									{/if}
									{#if !readOnly}
										<button type="button" class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0" title="Edit address for {r.name}" onclick={() => openAddress(r)}>
											<PencilIcon class="size-3.5" />
										</button>
									{/if}
								</div>
							</td>
							<td class="px-3 py-2 whitespace-nowrap text-right font-semibold tabular-nums">{r.total}</td>
							<td class="px-3 py-2">
								{#if r.financialStatus}
									<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap {financialBadge(r.financialStatus)}">{humanizeEnum(r.financialStatus)}</span>
								{/if}
							</td>
							{#if readOnly}
								<td class="px-3 py-2">
									{#if r.fulfillmentStatus}
										<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap {fulfillmentBadge(r.fulfillmentStatus)}">{humanizeEnum(r.fulfillmentStatus)}</span>
									{/if}
								</td>
							{/if}
							<td class="px-3 py-2">
								<Popover.Root>
									<Popover.Trigger>
										{#snippet child({ props })}
											<button type="button" {...props} class="inline-flex items-center gap-1 whitespace-nowrap hover:text-primary rounded-md px-1.5 -mx-1.5 data-[state=open]:bg-primary/5">
												{r.items} {r.items === 1 ? 'item' : 'items'}
												<ChevronDownIcon class="size-3.5" />
											</button>
										{/snippet}
									</Popover.Trigger>
									<Popover.Content class="w-80 p-0 gap-0 overflow-hidden" align="center">
										<div class="divide-y divide-border overflow-y-auto" style="max-height: min(60vh, var(--bits-floating-available-height, 60vh));">
											{#each r.lineItems as item (item.id)}
												<div class="flex items-center gap-3 px-3 py-2.5">
													{#if item.imageUrl}
														<img src={item.imageUrl} alt={item.title} class="size-10 rounded-md object-cover border border-border shrink-0" />
													{:else}
														<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
													{/if}
													<div class="min-w-0 flex-1">
														<div class="text-sm font-medium text-foreground leading-snug">{item.title}</div>
														{#if item.variantTitle}
															<span class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">{item.variantTitle}</span>
														{/if}
													</div>
													<span class="text-sm text-muted-foreground shrink-0">×{item.quantity}</span>
												</div>
											{/each}
										</div>
									</Popover.Content>
								</Popover.Root>
							</td>
							{#if !readOnly}
							<td class="px-3 py-2">
								<div class="flex items-center gap-1.5">
									{#if tab === 'confirmed'}
										<Button size="sm" variant="outline" onclick={() => askMove('pending', [r])}>Undo</Button>
									{:else}
										<Button size="sm" onclick={() => askMove('confirmed', [r])}>Confirm</Button>
										{#if tab === 'pending'}
											<Button size="sm" variant="outline" onclick={() => askBetween([r])}>Between</Button>
										{:else}
											<Button size="sm" variant="ghost" onclick={() => askMove('pending', [r])}>To pending</Button>
										{/if}
									{/if}
								</div>
							</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if pageRows.length === 0}
			<div class="px-4 py-10 text-center text-sm text-muted-foreground">
				{#if search}
					No orders match your search.
				{:else if tab === 'pending'}
					No pending orders. Everything is confirmed.
				{:else if tab === 'between'}
					Nothing in Between.
				{:else if tab === 'fulfilled'}
					No fulfilled open orders.
				{:else}
					No confirmed open orders yet.
				{/if}
			</div>
		{/if}

		{#if pageCount > 1}
			<div class="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-border text-sm">
				<span class="text-muted-foreground tabular-nums">
					{pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
				</span>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" disabled={pageIndex === 0} onclick={() => { pageIndex--; selected = new Set(); }}>← Previous</Button>
					<Button variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onclick={() => { pageIndex++; selected = new Set(); }}>Next →</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

{#snippet orderSummary(orders: EasyConfirmRow[])}
	<div class="space-y-2">
		{#each orders.slice(0, 5) as o (o.id)}
			<div class="rounded-lg border border-border px-3 py-2 text-sm space-y-0.5">
				<div class="font-semibold">{o.name} · {o.customer}</div>
				<div class="font-mono text-xs">{o.phone || 'No phone'}</div>
				<div class="text-xs">{o.address || 'No shipping address'}</div>
				<div class="text-xs text-muted-foreground">{o.total} · {humanizeEnum(o.financialStatus)}</div>
			</div>
		{/each}
		{#if orders.length > 5}
			<p class="text-xs text-muted-foreground">…and {orders.length - 5} more</p>
		{/if}
	</div>
{/snippet}

<!-- Confirm / back-to-pending modal -->
<Dialog.Root open={!!pendingMove} onOpenChange={(open) => { if (!open && !submitting) pendingMove = null; }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{moveHeading}</Dialog.Title>
		</Dialog.Header>
		{#if pendingMove}
			{@render orderSummary(pendingMove.orders)}
			{#if pendingMove.to === 'pending'}
				<p class="text-sm text-muted-foreground">This removes the Confirmed tag and any Between reason.</p>
			{/if}
		{/if}
		<Dialog.Footer>
			<Button variant="outline" disabled={submitting} onclick={() => (pendingMove = null)}>Cancel</Button>
			<Button onclick={submitMove} disabled={submitting}>
				{#if submitting}<Loader2Icon class="size-4 animate-spin" />{/if}
				{pendingMove?.to === 'pending' ? 'Yes, move to pending' : 'Yes, confirm'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Between reason modal -->
<Dialog.Root open={!!betweenOrders} onOpenChange={(open) => { if (!open && !submitting) betweenOrders = null; }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{betweenOrders && betweenOrders.length === 1 ? `Move ${betweenOrders[0].name} to Between` : `Move ${betweenOrders?.length ?? 0} orders to Between`}
			</Dialog.Title>
			<Dialog.Description>Why is this on hold?</Dialog.Description>
		</Dialog.Header>
		{#if betweenOrders}
			<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); submitBetween(); }}>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
					{#each BETWEEN_REASONS as reason (reason.tag)}
						{@const active = betweenReason === reason.tag}
						<button
							type="button"
							role="radio"
							aria-checked={active}
							onclick={() => (betweenReason = reason.tag)}
							class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors
								{active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-accent'}"
						>
							{reason.label}
						</button>
					{/each}
				</div>
				{#if betweenTried && !betweenReason}
					<p class="text-xs text-destructive -mt-2">Pick a reason</p>
				{/if}

				{#if betweenReason === BETWEEN_OTHER_TAG}
					<div class="space-y-1.5">
						<Label for="between-note">Reason</Label>
						<Input
							id="between-note"
							bind:value={betweenNote}
							maxlength={BETWEEN_NOTE_MAX}
							placeholder="e.g. customer wants delivery after Eid"
							autofocus
							aria-invalid={betweenTried && !betweenNote.trim()}
						/>
						{#if betweenTried && !betweenNote.trim()}
							<p class="text-xs text-destructive">Type a reason</p>
						{/if}
					</div>
				{/if}

				{@render orderSummary(betweenOrders)}

				<Dialog.Footer>
					<Button type="button" variant="outline" disabled={submitting} onclick={() => (betweenOrders = null)}>Cancel</Button>
					<Button type="submit" disabled={submitting}>
						{#if submitting}<Loader2Icon class="size-4 animate-spin" />{/if}
						Move to Between
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Merge modal -->
<Dialog.Root open={!!mergeOrders} onOpenChange={(open) => { if (!open && !merging) mergeOrders = null; }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Merge {mergeOrders?.length ?? 0} orders</Dialog.Title>
			<Dialog.Description>
				Pick the order everything moves into. The other {(mergeOrders?.length ?? 1) - 1} will be cancelled — this can't be undone.
			</Dialog.Description>
		</Dialog.Header>
		{#if mergeOrders}
			<div class="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
				Orders you don't pick as the main order are cancelled once their items are moved.
			</div>
			<RadioGroup.Root bind:value={mergeMainId} class="gap-2">
				{#each mergeOrders as o (o.id)}
					<label class="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors {mergeMainId === o.id ? 'border-primary/50 bg-primary/5' : ''}">
						<RadioGroup.Item value={o.id} />
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm">{o.name} <span class="font-normal text-muted-foreground">· {o.date}</span></div>
							<div class="text-xs text-muted-foreground">{o.items} {o.items === 1 ? 'item' : 'items'} · {o.total}</div>
						</div>
						{#if mergeMainId === o.id}
							<span class="text-xs font-semibold text-primary shrink-0">Main order</span>
						{/if}
					</label>
				{/each}
			</RadioGroup.Root>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" disabled={merging} onclick={() => (mergeOrders = null)}>Cancel</Button>
			<Button variant="destructive" disabled={merging || !mergeMainId} onclick={submitMerge}>
				{#if merging}<Loader2Icon class="size-4 animate-spin" />{/if}
				{merging ? 'Merging…' : 'Merge & cancel others'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Address modal -->
<Dialog.Root open={!!addressTarget} onOpenChange={(open) => { if (!open && !savingAddress) addressTarget = null; }}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit address{addressTarget ? ` · ${addressTarget.order.name}` : ''}</Dialog.Title>
		</Dialog.Header>
		{#if addressTarget}
			{@const f = addressTarget.fields}
			<form class="space-y-3" onsubmit={(e) => { e.preventDefault(); saveAddress(); }}>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5"><Label for="ec-first">First name</Label><Input id="ec-first" bind:value={f.firstName} /></div>
					<div class="space-y-1.5"><Label for="ec-last">Last name</Label><Input id="ec-last" bind:value={f.lastName} /></div>
				</div>
				<div class="space-y-1.5">
					<Label for="ec-addr1">Address</Label>
					<Input id="ec-addr1" bind:value={f.address1} aria-invalid={addressErrors && !f.address1.trim()} />
					{#if addressErrors && !f.address1.trim()}<p class="text-xs text-destructive">Enter an address</p>{/if}
				</div>
				<div class="space-y-1.5"><Label for="ec-addr2">Apartment, suite, etc.</Label><Input id="ec-addr2" bind:value={f.address2} /></div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="ec-city">City</Label>
						<Input id="ec-city" bind:value={f.city} aria-invalid={addressErrors && !f.city.trim()} />
						{#if addressErrors && !f.city.trim()}<p class="text-xs text-destructive">Enter a city</p>{/if}
					</div>
					<div class="space-y-1.5">
						<Label for="ec-province">Province</Label>
						{#if !f.countryCode || f.countryCode === 'PK'}
							<select id="ec-province" bind:value={f.provinceCode} class="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm">
								<option value="">Select province</option>
								{#each PK_PROVINCES as p (p.code)}
									<option value={p.code}>{p.name}</option>
								{/each}
							</select>
						{:else}
							<Input id="ec-province" bind:value={f.provinceCode} placeholder="Province code" />
						{/if}
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5"><Label for="ec-zip">Postal code</Label><Input id="ec-zip" bind:value={f.zip} /></div>
					<div class="space-y-1.5"><Label for="ec-phone">Phone</Label><Input id="ec-phone" bind:value={f.phone} /></div>
				</div>
				<p class="text-xs text-muted-foreground">Country: {f.country || f.countryCode || 'Pakistan'}</p>
				<Dialog.Footer>
					<Button type="button" variant="outline" disabled={savingAddress} onclick={() => (addressTarget = null)}>Cancel</Button>
					<Button type="submit" disabled={savingAddress}>
						{#if savingAddress}<Loader2Icon class="size-4 animate-spin" />{/if}
						Save
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
