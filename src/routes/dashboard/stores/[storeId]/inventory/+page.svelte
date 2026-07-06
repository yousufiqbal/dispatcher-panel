<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.q ?? '');
	let searchTimeout: ReturnType<typeof setTimeout>;
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

	function qtyClass(qty: number | null) {
		const n = qty ?? 0;
		if (n <= 0) return 'bg-red-100 text-red-700';
		if (n < 5) return 'bg-amber-100 text-amber-800';
		return 'bg-green-100 text-green-800';
	}

	function optionsLabel(opts: { name: string; value: string }[], fallback: string) {
		if (opts.length > 0) return opts.map((o) => o.value).join(' / ');
		return fallback === 'Default Title' ? 'Default' : fallback;
	}
</script>

<svelte:head>
	<title>Inventory — Dispatcher Panel</title>
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
				placeholder="Search Inventory"
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
			<h3 class="font-semibold text-foreground mb-1">No products found</h3>
			{#if searchInput}
				<p class="text-sm text-muted-foreground">No results for "{searchInput}"</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-4 {compact ? 'lg:max-w-[50%]' : ''}">
			{#each data.products as product}
				<div class="card overflow-hidden">
					<div class="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border bg-muted/20">
						{#if product.featuredImage}
							<img src={product.featuredImage.url} alt={product.featuredImage.altText ?? ''} class="size-9 rounded-md object-cover border border-border shrink-0" />
						{:else}
							<div class="size-9 rounded-md bg-muted border border-border shrink-0"></div>
						{/if}
						<h2 class="font-semibold text-sm flex-1 truncate">{product.title}</h2>
						<span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 {qtyClass(product.totalInventory)}">
							{product.totalInventory} total
						</span>
					</div>

					<!-- Desktop: compact table -->
					<table class="w-full text-sm hidden sm:table">
						<thead>
							<tr class="border-b border-border">
								<th class="text-left px-5 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Variant</th>
								<th class="text-left px-5 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">SKU</th>
								<th class="text-right px-5 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">In Stock</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each product.variants.nodes as variant}
								<tr>
									<td class="px-5 py-2">{optionsLabel(variant.selectedOptions, variant.title)}</td>
									<td class="px-5 py-2 font-mono text-xs text-muted-foreground">{variant.sku ?? '—'}</td>
									<td class="px-5 py-2 text-right">
										<span class="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-semibold {qtyClass(variant.inventoryQuantity)}">
											{variant.inventoryQuantity ?? 0}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<!-- Mobile: stacked rows -->
					<div class="sm:hidden divide-y divide-border">
						{#each product.variants.nodes as variant}
							<div class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
								<div class="min-w-0">
									<div class="truncate">{optionsLabel(variant.selectedOptions, variant.title)}</div>
									{#if variant.sku}<div class="text-xs text-muted-foreground font-mono">{variant.sku}</div>{/if}
								</div>
								<span class="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 {qtyClass(variant.inventoryQuantity)}">
									{variant.inventoryQuantity ?? 0}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if data.pageInfo.hasNextPage}
			<div class="flex justify-center mt-4">
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
	{/if}
</div>
