<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.q ?? '');
	let searchTimeout: ReturnType<typeof setTimeout>;
	const storeId = $derived($page.params.storeId);
	let loadingMore = $state(false);
	let compact = $state(false);

	$effect(() => {
		data;
		loadingMore = false;
	});

	function onSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const sp = new URLSearchParams();
			if (searchInput) sp.set('q', searchInput);
			goto(`?${sp}`, { keepFocus: true });
		}, 350);
	}

	function nextPage() {
		loadingMore = true;
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('after', data.pageInfo.endCursor);
		goto(`?${sp}`, { keepFocus: true });
	}
</script>

<svelte:head>
	<title>Customers — Dispatcher Panel</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="flex items-center justify-between gap-4 mb-5">
		<div class="flex-1 max-w-sm relative">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="search"
				class="input pl-9"
				placeholder="Search Customers"
				bind:value={searchInput}
				oninput={onSearch}
			/>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<a href="/dashboard/stores/{storeId}/customers/new" class="btn-primary shrink-0 size-9 p-0 sm:size-auto sm:px-4 sm:py-2">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
				</svg>
				<span class="hidden sm:inline">New Customer</span>
			</a>
			<button
				onclick={() => compact = !compact}
				class="hidden lg:inline-flex btn-icon btn-secondary"
				title={compact ? 'Expand to full width' : 'Compact width'}
			>
				{#if compact}
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
					</svg>
				{:else}
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
					</svg>
				{/if}
			</button>
		</div>
	</div>

	{#if data.customers.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No customers found</h3>
			{#if searchInput}
				<p class="text-sm text-muted-foreground">No results for "{searchInput}"</p>
			{/if}
		</div>
	{:else}
		<div class="card overflow-hidden {compact ? 'lg:max-w-[50%]' : ''}">
			<div class="divide-y divide-border">
				{#each data.customers as customer}
					<a
						href="/dashboard/stores/{storeId}/customers/{customer.id.split('/').pop()}"
						class="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
					>
						<div class="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
							{customer.displayName[0]?.toUpperCase() ?? '?'}
						</div>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm text-foreground">{customer.displayName}</div>
							<div class="text-xs text-muted-foreground">{customer.email ?? ''}{customer.email && customer.phone ? ' · ' : ''}{customer.phone ?? ''}</div>
						</div>
						<div class="text-xs text-muted-foreground">{customer.numberOfOrders} order{customer.numberOfOrders !== 1 ? 's' : ''}</div>
						<svg class="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</a>
				{/each}
			</div>

			{#if data.pageInfo.hasNextPage}
				<div class="flex justify-center p-4 border-t border-border">
					<button class="btn-secondary inline-flex items-center gap-2" disabled={loadingMore} onclick={nextPage}>
						{#if loadingMore}
							<svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
							</svg>
						{/if}
						{loadingMore ? 'Loading…' : 'Load more'}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
