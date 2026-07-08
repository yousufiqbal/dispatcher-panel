<script lang="ts">
	import { page } from '$app/stores';
	import { formatCurrency } from '$lib/utils';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ImageIcon from '@lucide/svelte/icons/image';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const product = $derived(data.product);
	const storeId = $derived($page.params.storeId);

	let activeImage = $state(0);
	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');

	function optionsLabel(opts: { name: string; value: string }[]) {
		return opts.map((o) => o.value).join(' / ');
	}
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

	<div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
		<!-- Images -->
		<div>
			{#if product.images.nodes.length > 0}
				<button
					type="button"
					class="block w-full cursor-zoom-in"
					onclick={() => { lightboxUrl = product.images.nodes[activeImage].url; lightboxAlt = product.images.nodes[activeImage].altText ?? product.title; }}
				>
					<img
						src={product.images.nodes[activeImage].url}
						alt={product.images.nodes[activeImage].altText ?? product.title}
						class="w-full aspect-square object-cover rounded-md border border-border mb-2"
					/>
				</button>
				{#if product.images.nodes.length > 1}
					<div class="flex gap-2 overflow-x-auto">
						{#each product.images.nodes as img, i}
							<button
								onclick={() => activeImage = i}
								class="size-14 rounded-md border shrink-0 overflow-hidden {i === activeImage ? 'border-primary ring-2 ring-primary/30' : 'border-border'}"
							>
								<img src={img.url} alt={img.altText ?? ''} class="w-full h-full object-cover" />
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="w-full aspect-square rounded-md bg-muted flex items-center justify-center border border-border">
					<ImageIcon class="size-12 text-muted-foreground" />
				</div>
			{/if}
		</div>

		<!-- Description -->
		<div class="card overflow-hidden">
			<div class="px-5 py-4 border-b border-border">
				<h2 class="font-semibold text-sm">Description</h2>
			</div>
			<div class="p-5">
				{#if product.descriptionHtml}
					<div class="text-sm text-foreground [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_strong]:font-semibold">{@html product.descriptionHtml}</div>
				{:else}
					<p class="text-sm text-muted-foreground">No Description</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Variants -->
	<div class="card overflow-hidden">
		<div class="px-5 py-4 border-b border-border">
			<h2 class="font-semibold text-sm">Variants</h2>
		</div>
		<div class="divide-y divide-border">
			{#each product.variants.nodes as variant}
				<div class="flex items-center gap-3 px-5 py-3">
					{#if variant.image}
						{@const vImg = variant.image}
						<button
							type="button"
							class="shrink-0 cursor-zoom-in"
							onclick={() => { lightboxUrl = vImg.url; lightboxAlt = vImg.altText ?? product.title; }}
						>
							<img src={vImg.url} alt={vImg.altText ?? ''} class="size-10 rounded-md object-cover border border-border" />
						</button>
					{/if}
					<div class="flex-1 min-w-0">
						{#if variant.selectedOptions.length > 0}
							<div class="font-medium text-sm text-foreground">{optionsLabel(variant.selectedOptions)}</div>
						{:else if variant.title !== 'Default Title'}
							<div class="font-medium text-sm text-foreground">{variant.title}</div>
						{/if}
						{#if variant.sku}
							<div class="text-xs text-muted-foreground font-mono">SKU: {variant.sku}</div>
						{/if}
					</div>
					<div class="text-right shrink-0">
						<div class="text-sm font-semibold text-foreground">{formatCurrency(variant.price, data.currencyCode)}</div>
						<div class="text-xs {(variant.inventoryQuantity ?? 0) > 0 ? 'text-muted-foreground' : 'text-destructive'}">
							{variant.inventoryQuantity ?? 0} in stock
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<Lightbox bind:url={lightboxUrl} alt={lightboxAlt} />
