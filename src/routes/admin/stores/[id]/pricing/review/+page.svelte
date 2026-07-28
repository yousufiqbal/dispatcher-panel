<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ImageIcon from '@lucide/svelte/icons/image';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const storeId = $derived($page.params.id);

	let applying = $state(false);
	const totalVariants = $derived(data.changedProducts.reduce((n, p) => n + p.variants.length, 0));
</script>

<svelte:head>
	<title>Review pricing changes — {data.store.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-4xl mx-auto">
	<PageHeaderBack href="/admin/stores/{storeId}/pricing" backTitle="Back to Pricing" title="Review changes" />

	{#if form?.applyError}
		<div class="card border-destructive/40 bg-destructive/5 px-4 py-3 mb-4 text-sm text-destructive">
			{form.applyError}
			{#if form.appliedCount}<div class="mt-1 text-xs">{form.appliedCount} variant(s) applied before the error.</div>{/if}
		</div>
	{/if}

	{#if data.changedProducts.length === 0}
		<div class="card p-8 text-center text-sm text-muted-foreground">Nothing pending — everything on Shopify already matches the suggested pricing.</div>
	{:else}
		<p class="text-sm text-muted-foreground mb-4">{totalVariants} variant(s) across {data.changedProducts.length} product(s) will change.</p>

		<div class="space-y-4 mb-6">
			{#each data.changedProducts as product}
				<div class="card overflow-hidden">
					<div class="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
						{#if product.imageUrl}
							<img src={product.imageUrl} alt="" class="size-8 rounded object-cover border border-border" />
						{:else}
							<div class="size-8 rounded bg-muted flex items-center justify-center border border-border">
								<ImageIcon class="size-4 text-muted-foreground" />
							</div>
						{/if}
						<div class="text-sm font-semibold text-foreground">{product.title}</div>
					</div>
					<div class="divide-y divide-border">
						{#each product.variants as v}
							<div class="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr_1fr] gap-2 px-4 py-3 text-sm items-center">
								<div class="flex items-center gap-2 min-w-0">
									{#if v.imageUrl}
										<img src={v.imageUrl} alt="" class="size-8 rounded object-cover border border-border shrink-0" />
									{:else}
										<div class="size-8 rounded bg-muted shrink-0 border border-border"></div>
									{/if}
									<div class="min-w-0">
										<div class="text-foreground font-medium truncate">{v.title === 'Default Title' ? product.title : v.title}</div>
										{#if v.sku}<div class="text-xs text-muted-foreground">{v.sku}</div>{/if}
									</div>
								</div>
								<div>
									{#if Math.round(v.currentPrice) !== Math.round(v.finalPrice)}
										<div class="text-xs text-muted-foreground">Price</div>
										<div>Rs {v.currentPrice.toFixed(0)} <span class="text-muted-foreground">→</span> <span class="font-semibold text-foreground">Rs {v.finalPrice.toFixed(0)}</span></div>
									{/if}
								</div>
								<div>
									{#if Math.round(v.currentCompareAtPrice ?? 0) !== Math.round(v.finalCompareAtPrice)}
										<div class="text-xs text-muted-foreground">Compare-at</div>
										<div>Rs {(v.currentCompareAtPrice ?? 0).toFixed(0)} <span class="text-muted-foreground">→</span> <span class="font-semibold text-foreground">Rs {v.finalCompareAtPrice.toFixed(0)}</span></div>
									{/if}
								</div>
								<div>
									{#if v.weightOverridden && v.weightGrams !== v.liveWeightGrams}
										<div class="text-xs text-muted-foreground">Weight</div>
										<div>{v.liveWeightGrams}g <span class="text-muted-foreground">→</span> <span class="font-semibold text-foreground">{v.weightGrams}g</span></div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<form
			method="POST"
			action="?/apply"
			use:enhance={() => {
				applying = true;
				return async ({ update }) => {
					applying = false;
					await update();
				};
			}}
		>
			<Button type="submit" disabled={applying}>
				{#if applying}<Loader2Icon class="size-4 animate-spin" />{/if}
				Apply {totalVariants} change{totalVariants !== 1 ? 's' : ''} to Shopify
			</Button>
		</form>
	{/if}
</div>
