<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ImageIcon from '@lucide/svelte/icons/image';
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
	<title>Products — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="flex items-center justify-between gap-4 mb-5">
		<div class="flex-1 max-w-sm relative">
			<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
			<Input
				type="search"
				class="pl-9"
				placeholder="Search {data.totalCount} Products"
				bind:value={searchInput}
				oninput={onSearch}
			/>
		</div>
		<Button
			onclick={() => compact = !compact}
			variant="outline"
			size="icon"
			class="hidden lg:inline-flex shrink-0"
			title={compact ? 'Expand to full width' : 'Compact width'}
		>
			{#if compact}
				<Minimize2Icon class="size-4" />
			{:else}
				<Maximize2Icon class="size-4" />
			{/if}
		</Button>
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
						href="/dispatcher/stores/{storeId}/products/{product.id.split('/').pop()}"
						class="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-muted/30 transition-colors"
					>
						{#if product.featuredImage}
							<img src={product.featuredImage.url} alt={product.featuredImage.altText ?? ''} class="size-12 rounded-md object-cover border border-border shrink-0" />
						{:else}
							<div class="size-12 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
								<ImageIcon class="size-5 text-muted-foreground" />
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
						<ChevronRightIcon class="size-4 text-muted-foreground shrink-0" />
					</a>
				{/each}
			</div>

			{#if data.pageInfo.hasNextPage}
				<div class="flex justify-center p-4 border-t border-border">
					<Button variant="outline" disabled={loadingMore} onclick={nextPage}>
						{#if loadingMore}
							<Loader2Icon class="size-4 animate-spin" />
						{/if}
						{loadingMore ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>
