<script lang="ts">
	import { page } from '$app/stores';
	import ProductDetail from '$lib/components/ProductDetail.svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PackageSearchIcon from '@lucide/svelte/icons/package-search';
	import type { ProductDetail as ProductDetailData } from '$lib/server/shopify/products';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const storeId = $derived($page.params.storeId);

	// Master/detail: on desktop a click loads the product into the right-hand
	// pane instead of navigating away. Narrow screens keep the full-page link.
	type Detail = { product: ProductDetailData; currencyCode: string };
	let selectedId = $state<string | null>(null);
	let detail = $state<Detail | null>(null);
	let detailLoading = $state(false);
	let detailError = $state<string | null>(null);
	const detailCache = new Map<string, Detail>();

	function shortId(gid: string) {
		return gid.split('/').pop() ?? gid;
	}

	async function selectProduct(e: MouseEvent, gid: string) {
		if (window.innerWidth < 1024 || e.metaKey || e.ctrlKey || e.button !== 0) return;
		e.preventDefault();
		selectedId = gid;
		detailError = null;
		const cached = detailCache.get(gid);
		if (cached) {
			detail = cached;
			return;
		}
		detailLoading = true;
		try {
			const res = await fetch(`/api/dispatcher/stores/${storeId}/products/${shortId(gid)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const d: Detail = await res.json();
			detailCache.set(gid, d);
			if (selectedId === gid) detail = d;
		} catch (err) {
			if (selectedId === gid) detailError = err instanceof Error ? err.message : 'Failed to load';
		} finally {
			if (selectedId === gid) detailLoading = false;
		}
	}

	// Collection filter lives in the URL (?collection=<id>|none) so it survives
	// reloads and back-navigation. Filtering is client-side: every product is
	// already loaded with its collection ids.
	const collectionFilter = $derived($page.url.searchParams.get('collection') ?? 'all');

	function inCollection(p: PageData['products'][number], key: string): boolean {
		if (key === 'all') return true;
		if (key === 'none') return p.collections.nodes.length === 0;
		return p.collections.nodes.some((c) => c.id === key);
	}

	const filteredProducts = $derived(data.products.filter((p) => inCollection(p, collectionFilter)));

	const filterTabs = $derived([
		{ key: 'all', label: 'All', count: data.products.length },
		...data.collections.map((c) => ({
			key: c.id,
			label: c.title,
			count: data.products.filter((p) => inCollection(p, c.id)).length
		})),
		{ key: 'none', label: 'Uncollected', count: data.products.filter((p) => inCollection(p, 'none')).length }
	]);

	function filterHref(key: string): string {
		const sp = new URLSearchParams($page.url.searchParams);
		if (key === 'all') sp.delete('collection');
		else sp.set('collection', key);
		const qs = sp.toString();
		return qs ? `?${qs}` : $page.url.pathname;
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
	<!-- Collection filter -->
	<div class="mb-5">
		<div class="flex flex-wrap items-center gap-2">
			{#each filterTabs as tab}
				{@const isActive = collectionFilter === tab.key}
				<a
					href={filterHref(tab.key)}
					class="inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150
						{isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border border-zinc-200 text-muted-foreground hover:bg-accent'}"
				>
					{tab.label}
					<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold {isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-zinc-100 text-zinc-500'}">
						{tab.count}
					</span>
				</a>
			{/each}
		</div>
	</div>

	<div class="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-5 lg:items-start">
	{#if filteredProducts.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No products found</h3>
		</div>
	{:else}
		<div class="card overflow-hidden">
			<div class="divide-y divide-border">
				{#each filteredProducts as product (product.id)}
					{@const isSelected = selectedId === product.id}
					<a
						href="/dispatcher/stores/{storeId}/products/{shortId(product.id)}"
						onclick={(e) => selectProduct(e, product.id)}
						class="flex items-center gap-4 px-4 sm:px-6 py-4 transition-colors {isSelected ? 'bg-primary/5 lg:border-l-2 lg:border-l-primary' : 'hover:bg-muted/30'}"
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
		</div>
	{/if}

	<!-- Detail pane (desktop only) -->
	<div class="hidden lg:block sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
		{#if detailLoading}
			<div class="card p-12 flex items-center justify-center text-muted-foreground">
				<Loader2Icon class="size-6 animate-spin" />
			</div>
		{:else if detailError}
			<div class="card p-12 text-center">
				<h3 class="font-semibold text-foreground mb-1">Couldn't load product</h3>
				<p class="text-sm text-muted-foreground">{detailError}</p>
			</div>
		{:else if detail}
			{#snippet paneHeader()}
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h1 class="text-xl font-bold truncate">{detail!.product.title}</h1>
						<p class="text-sm text-muted-foreground">{detail!.product.totalInventory} total in stock</p>
					</div>
					<a
						href="/dispatcher/stores/{storeId}/products/{shortId(detail!.product.id)}"
						class="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
					>
						Open page
					</a>
				</div>
			{/snippet}
			<ProductDetail product={detail.product} currencyCode={detail.currencyCode} variantsFirst header={paneHeader} />
		{:else}
			<div class="card p-12 text-center text-muted-foreground">
				<PackageSearchIcon class="size-10 mx-auto mb-3 opacity-40" />
				<p class="text-sm">Select a product to see its details</p>
			</div>
		{/if}
	</div>
	</div>
</div>
