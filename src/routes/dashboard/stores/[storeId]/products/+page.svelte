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

	function statusBadge(status: string) {
		if (status === 'ACTIVE') return 'bg-green-100 text-green-800';
		if (status === 'DRAFT') return 'bg-zinc-100 text-zinc-700';
		return 'bg-amber-100 text-amber-800';
	}
</script>

<svelte:head>
	<title>Products — Dispatcher Panel</title>
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
				placeholder="Search {data.totalCount} Products"
				bind:value={searchInput}
				oninput={onSearch}
			/>
		</div>
		<button
			onclick={() => compact = !compact}
			class="hidden lg:inline-flex btn-icon btn-secondary shrink-0"
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

	{#if data.products.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No products found</h3>
			{#if searchInput}
				<p class="text-sm text-muted-foreground">No results for "{searchInput}"</p>
			{/if}
		</div>
	{:else}
		<div class="card overflow-hidden {compact ? 'lg:max-w-[50%]' : ''}">
			<div class="divide-y divide-border">
				{#each data.products as product}
					<a
						href="/dashboard/stores/{storeId}/products/{product.id.split('/').pop()}"
						class="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-muted/30 transition-colors"
					>
						{#if product.featuredImage}
							<img src={product.featuredImage.url} alt={product.featuredImage.altText ?? ''} class="size-12 rounded-md object-cover border border-border shrink-0" />
						{:else}
							<div class="size-12 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
								<svg class="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M4.5 3h15A1.5 1.5 0 0121 4.5v15a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19.5v-15A1.5 1.5 0 014.5 3z" />
								</svg>
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm text-foreground truncate">{product.title}</div>
							<div class="text-xs text-muted-foreground">
								{product.variants.nodes.length} variant{product.variants.nodes.length !== 1 ? 's' : ''}
								· {product.totalInventory} in stock
							</div>
						</div>
						<span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 {statusBadge(product.status)}">
							{product.status.charAt(0) + product.status.slice(1).toLowerCase()}
						</span>
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
