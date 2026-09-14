<script lang="ts">
	import { page } from '$app/stores';
	import ProductDetail from '$lib/components/ProductDetail.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const product = $derived(data.product);
	const storeId = $derived($page.params.storeId);
</script>

<svelte:head>
	<title>{product.title} — Products</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-4xl">
	<div class="mb-6">
		<Button href="/dispatcher/stores/{storeId}/products" variant="outline" size="icon" class="mb-3" title="Back to Products">
			<ArrowLeftIcon class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">{product.title}</h1>
		<p class="text-sm text-muted-foreground">{product.totalInventory} total in stock</p>
	</div>

	<ProductDetail {product} currencyCode={data.currencyCode} />
</div>
