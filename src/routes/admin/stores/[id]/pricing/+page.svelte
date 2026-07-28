<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { untrack } from 'svelte';
	import { calcSuggestedPricing, type CostCurrency } from '$lib/pricing';
	import { formatDateTimeLong } from '$lib/utils';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const storeId = $derived($page.params.id);

	let settings = $state({ ...data.store });
	let savingSettings = $state(false);

	type VariantRow = PageData['products'][number]['variants'][number];
	// Deep-cloned, client-owned copy so edits recompute instantly without a full reload.
	let products = $state(structuredClone(data.products));
	let pendingSave = new Map<string, ReturnType<typeof setTimeout>>();
	let savingVariants = $state(new Set<string>());

	const liveSettings = $derived({
		cnyToPkrRate: parseFloat(settings.cnyToPkrRate) || 0,
		shippingCostPerGram: parseFloat(settings.shippingCostPerGram) || 0,
		priceMultiplier: parseFloat(settings.priceMultiplier) || 0,
		compareAtMultiplier: parseFloat(settings.compareAtMultiplier) || 0,
		codPercentage: parseFloat(settings.codPercentage) || 0
	});

	// Recomputes the formula's suggestion (shown as a hint only). The final
	// price/compare-at default to the *current* live Shopify value and only
	// change when the merchant deliberately edits them via the handlers below —
	// nothing is pending/pushed just because a suggestion exists.
	function recalc(v: VariantRow) {
		v.suggestion =
			v.costAmount > 0
				? calcSuggestedPricing(
						{ costAmount: v.costAmount, costCurrency: v.costCurrency as CostCurrency, weightGrams: v.weightGrams },
						liveSettings
					)
				: null;
		if (!v.priceOverridden) v.finalPrice = v.currentPrice;
		if (!v.compareAtOverridden) v.finalCompareAtPrice = v.currentCompareAtPrice ?? 0;
		v.pending =
			Math.round(v.currentPrice) !== Math.round(v.finalPrice) ||
			Math.round(v.currentCompareAtPrice ?? 0) !== Math.round(v.finalCompareAtPrice) ||
			(v.weightOverridden && v.weightGrams !== v.liveWeightGrams);
	}

	// Recompute every variant whenever global settings change. The mutations
	// inside recalc() touch the same `products` state the loop reads, so they
	// must run untracked or the effect retriggers itself infinitely.
	$effect(() => {
		liveSettings;
		untrack(() => {
			for (const p of products) for (const v of p.variants) recalc(v);
		});
	});

	const hasPendingChanges = $derived(products.some((p) => p.variants.some((v) => v.pending)));

	function scheduleSave(v: VariantRow, productId: string) {
		recalc(v);
		const key = v.id;
		clearTimeout(pendingSave.get(key));
		pendingSave.set(
			key,
			setTimeout(async () => {
				savingVariants.add(key);
				savingVariants = new Set(savingVariants);
				const fd = new FormData();
				fd.set('variantId', v.id);
				fd.set('productId', productId);
				fd.set('costAmount', String(v.costAmount));
				fd.set('costCurrency', v.costCurrency);
				if (v.weightOverridden) fd.set('weightGrams', String(v.weightGrams));
				if (v.priceOverridden) fd.set('priceOverride', String(v.finalPrice));
				if (v.compareAtOverridden) fd.set('compareAtOverride', String(v.finalCompareAtPrice));
				try {
					const res = await fetch('?/saveVariant', { method: 'POST', body: fd });
					if (!res.ok) throw new Error('save failed');
				} catch {
					addToast('Failed to save — check connection', 'error');
				} finally {
					savingVariants.delete(key);
					savingVariants = new Set(savingVariants);
				}
			}, 500)
		);
	}

	function onWeightInput(v: VariantRow, productId: string, raw: string) {
		v.weightGrams = Math.max(0, Math.round(parseFloat(raw) || 0));
		v.weightOverridden = v.weightGrams !== v.liveWeightGrams;
		scheduleSave(v, productId);
	}

	function onPriceOverrideInput(v: VariantRow, productId: string, raw: string) {
		v.finalPrice = Math.max(0, parseFloat(raw) || 0);
		v.priceOverridden = true;
		v.pending = Math.round(v.currentPrice) !== Math.round(v.finalPrice) || Math.round(v.currentCompareAtPrice ?? 0) !== Math.round(v.finalCompareAtPrice);
		scheduleSave(v, productId);
	}

	function resetPriceOverride(v: VariantRow, productId: string) {
		v.priceOverridden = false;
		recalc(v);
		scheduleSave(v, productId);
	}

	function onCompareAtOverrideInput(v: VariantRow, productId: string, raw: string) {
		v.finalCompareAtPrice = Math.max(0, parseFloat(raw) || 0);
		v.compareAtOverridden = true;
		v.pending = Math.round(v.currentPrice) !== Math.round(v.finalPrice) || Math.round(v.currentCompareAtPrice ?? 0) !== Math.round(v.finalCompareAtPrice);
		scheduleSave(v, productId);
	}

	function resetCompareAtOverride(v: VariantRow, productId: string) {
		v.compareAtOverridden = false;
		recalc(v);
		scheduleSave(v, productId);
	}

	// Bulk edit: applies whichever fields are filled in to every variant on
	// one product card only. Blank fields leave that variant's existing value
	// untouched — this is a shortcut for the same per-row inputs, not a
	// separate mechanism, so it goes through the same recalc/scheduleSave path.
	let bulkEditProductId = $state<string | null>(null);
	let bulkWeight = $state('');
	let bulkCostAmount = $state('');
	let bulkCostCurrency = $state<CostCurrency>('cny');
	let bulkPrice = $state('');
	let bulkCompareAt = $state('');

	// Only computable once both weight and cost are entered here — each
	// variant on the card may currently have different weight/cost, so there's
	// no single "current" baseline to fall back on like the per-row hint has.
	const bulkSuggestion = $derived(
		bulkWeight !== '' && bulkCostAmount !== ''
			? calcSuggestedPricing(
					{
						costAmount: Math.max(0, parseFloat(bulkCostAmount) || 0),
						costCurrency: bulkCostCurrency,
						weightGrams: Math.max(0, Math.round(parseFloat(bulkWeight) || 0))
					},
					liveSettings
				)
			: null
	);

	function openBulkEdit(productId: string) {
		bulkEditProductId = productId;
		bulkWeight = '';
		bulkCostAmount = '';
		bulkCostCurrency = 'cny';
		bulkPrice = '';
		bulkCompareAt = '';
	}

	function applyBulkEdit() {
		const product = products.find((p) => p.id === bulkEditProductId);
		if (!product) return;

		for (const v of product.variants) {
			if (bulkWeight !== '') {
				v.weightGrams = Math.max(0, Math.round(parseFloat(bulkWeight) || 0));
				v.weightOverridden = v.weightGrams !== v.liveWeightGrams;
			}
			if (bulkCostAmount !== '') {
				v.costAmount = Math.max(0, parseFloat(bulkCostAmount) || 0);
				v.costCurrency = bulkCostCurrency;
			}
			if (bulkPrice !== '') {
				v.finalPrice = Math.max(0, parseFloat(bulkPrice) || 0);
				v.priceOverridden = true;
			}
			if (bulkCompareAt !== '') {
				v.finalCompareAtPrice = Math.max(0, parseFloat(bulkCompareAt) || 0);
				v.compareAtOverridden = true;
			}
			recalc(v);
			scheduleSave(v, product.id);
		}

		bulkEditProductId = null;
	}

	// Manual "reviewed" tick per product card — pure bookkeeping, persisted so
	// it survives refresh, independent of the pending/apply workflow.
	async function toggleReviewed(productId: string, checked: boolean) {
		const product = products.find((p) => p.id === productId);
		if (product) product.reviewed = checked;

		const fd = new FormData();
		fd.set('productId', productId);
		fd.set('checked', String(checked));
		try {
			const res = await fetch('?/toggleReviewed', { method: 'POST', body: fd });
			if (!res.ok) throw new Error('failed');
		} catch {
			addToast('Failed to save — check connection', 'error');
			if (product) product.reviewed = !checked;
		}
	}

	let resetConfirmOpen = $state(false);
	let resetConfirmText = $state('');
	let resettingAll = $state(false);
	const resetConfirmed = $derived(resetConfirmText.trim().toLowerCase() === 'reset');

	async function resetAllReviewed() {
		if (!resetConfirmed) return;
		resettingAll = true;
		try {
			const res = await fetch('?/resetAllReviewed', { method: 'POST', body: new FormData() });
			if (!res.ok) throw new Error('failed');
			for (const p of products) p.reviewed = false;
			addToast('All review ticks reset');
			resetConfirmOpen = false;
			resetConfirmText = '';
		} catch {
			addToast('Failed to reset — check connection', 'error');
		} finally {
			resettingAll = false;
		}
	}
</script>

<svelte:head>
	<title>Pricing — {data.store.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-7xl mx-auto">
	<PageHeaderBack href="/admin/stores/{storeId}" backTitle="Back to {data.store.name}" title="Pricing" />

	<div class="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 items-start">
		<div class="min-w-0">
			<div class="card mb-4">
				<div class="flex items-center justify-between px-4 pt-3">
					<h2 class="text-sm font-semibold">Rate settings</h2>
					{#if form?.settingsError}<span class="text-xs text-destructive">{form.settingsError}</span>{/if}
				</div>
				<form
					method="POST"
					action="?/saveSettings"
					use:enhance={() => {
						savingSettings = true;
						return async ({ update }) => {
							savingSettings = false;
							await update({ invalidateAll: false, reset: false });
							addToast('Settings saved');
						};
					}}
					class="flex flex-wrap items-end gap-2 px-4 py-3"
				>
					<label class="text-xs">
						<div class="text-muted-foreground mb-1">CNY → PKR</div>
						<input class="input h-8 py-1 w-20 text-sm" name="cnyToPkrRate" bind:value={settings.cnyToPkrRate} type="number" step="0.01" min="0" />
					</label>
					<label class="text-xs">
						<div class="text-muted-foreground mb-1">Shipping/g (Rs)</div>
						<input class="input h-8 py-1 w-20 text-sm" name="shippingCostPerGram" bind:value={settings.shippingCostPerGram} type="number" step="0.01" min="0" />
					</label>
					<label class="text-xs">
						<div class="text-muted-foreground mb-1">Price ×</div>
						<input class="input h-8 py-1 w-16 text-sm" name="priceMultiplier" bind:value={settings.priceMultiplier} type="number" step="0.01" min="0" />
					</label>
					<label class="text-xs">
						<div class="text-muted-foreground mb-1">Compare-at ×</div>
						<input class="input h-8 py-1 w-16 text-sm" name="compareAtMultiplier" bind:value={settings.compareAtMultiplier} type="number" step="0.01" min="0" />
					</label>
					<label class="text-xs">
						<div class="text-muted-foreground mb-1">COD %</div>
						<input class="input h-8 py-1 w-16 text-sm" name="codPercentage" bind:value={settings.codPercentage} type="number" step="0.01" min="0" />
					</label>
					<Button type="submit" size="sm" disabled={savingSettings}>
						{#if savingSettings}<Loader2Icon class="size-4 animate-spin" />{/if}
						Save
					</Button>
				</form>
				<p class="text-xs text-muted-foreground px-4 pb-3 leading-relaxed">
					Suggested price = (cost + weight(g) × shipping/g) × price × (1 + COD%), rounded to nearest 10.
					Suggested compare-at uses the same base cost with the compare-at multiplier instead. Cost in CNY is converted using the CNY → PKR rate first.
				</p>
			</div>

			<div class="space-y-4">
				{#each products as product (product.id)}
			<div class="card overflow-hidden">
				<div class="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
					{#if product.imageUrl}
						<img src={product.imageUrl} alt="" class="size-8 rounded object-cover border border-border" />
					{:else}
						<div class="size-8 rounded bg-muted flex items-center justify-center border border-border">
							<ImageIcon class="size-4 text-muted-foreground" />
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold text-foreground truncate">{product.title}</div>
						{#if product.lastModifiedAt}
							<div class="text-xs text-muted-foreground">Last modified {formatDateTimeLong(product.lastModifiedAt)}</div>
						{/if}
					</div>
					<button
						type="button"
						title={product.reviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
						onclick={() => toggleReviewed(product.id, !product.reviewed)}
						class="shrink-0 inline-flex items-center justify-center size-8 rounded-lg border transition-colors {product.reviewed ? 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}"
					>
						<CheckIcon class="size-4" />
					</button>
					<Button variant="outline" size="sm" onclick={() => openBulkEdit(product.id)}>
						<PencilIcon class="size-3.5" />
						Bulk edit
					</Button>
				</div>
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-[12rem] max-w-[12rem]">Variant</Table.Head>
								<Table.Head class="min-w-[6rem]">Weight (g)</Table.Head>
								<Table.Head class="min-w-[10rem]">Buying cost</Table.Head>
								<Table.Head class="min-w-[6rem]">Landed cost</Table.Head>
								<Table.Head class="min-w-[7rem]">Final price</Table.Head>
								<Table.Head class="min-w-[7rem]">Final compare-at</Table.Head>
								<Table.Head class="w-10"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each product.variants as v (v.id)}
								<Table.Row>
									<Table.Cell class="align-top w-[12rem] max-w-[12rem]">
										<div class="h-4 mb-1"></div>
										<div class="flex items-center gap-2 min-w-0">
											{#if v.imageUrl}
												<img src={v.imageUrl} alt="" class="size-8 rounded object-cover border border-border shrink-0" />
											{:else}
												<div class="size-8 rounded bg-muted shrink-0 border border-border"></div>
											{/if}
											<div class="min-w-0 flex-1">
												<div class="truncate text-foreground font-medium" title={v.title === 'Default Title' ? product.title : v.title}>{v.title === 'Default Title' ? product.title : v.title}</div>
												{#if v.sku}<div class="text-xs text-muted-foreground truncate">{v.sku}</div>{/if}
											</div>
										</div>
										<div class="h-4 mt-0.5"></div>
									</Table.Cell>

									<Table.Cell class="align-top">
										<div class="h-4 mb-1"></div>
										<input
											class="input h-8 py-1 text-sm w-24 min-w-0"
											type="number" min="0" step="1"
											value={v.weightGrams}
											oninput={(e) => onWeightInput(v, product.id, e.currentTarget.value)}
										/>
										<div class="h-4 mt-0.5"></div>
									</Table.Cell>

									<Table.Cell class="align-top">
										<div class="h-4 mb-1"></div>
										<div class="flex gap-1">
											<input
												class="input h-8 py-1 text-sm w-24 min-w-0"
												type="number" min="0" step="0.01"
												value={v.costAmount}
												oninput={(e) => { v.costAmount = parseFloat(e.currentTarget.value) || 0; scheduleSave(v, product.id); }}
											/>
											<select
												class="input h-8 py-1 text-sm w-[4.5rem] shrink-0 px-1"
												value={v.costCurrency}
												onchange={(e) => { v.costCurrency = e.currentTarget.value as CostCurrency; scheduleSave(v, product.id); }}
											>
												<option value="cny">CNY</option>
												<option value="pkr">PKR</option>
											</select>
										</div>
										<div class="h-4 mt-0.5"></div>
									</Table.Cell>

									<Table.Cell class="align-top">
										<div class="h-4 mb-1"></div>
										<div class="text-sm">{v.suggestion ? `Rs ${v.suggestion.baseCost.toFixed(0)}` : '—'}</div>
										<div class="h-4 mt-0.5">
											{#if v.suggestion}
												{@const profit = v.finalPrice - v.suggestion.baseCost}
												<span class="text-xs {profit >= 0 ? 'text-green-700' : 'text-destructive'}">
													{profit >= 0 ? 'Earn' : 'Lose'} Rs {Math.abs(profit).toFixed(0)}
												</span>
											{/if}
										</div>
									</Table.Cell>

									<Table.Cell class="align-top">
										<div class="h-4 mb-1 text-xs text-muted-foreground truncate">
											{v.suggestion ? `Suggested Rs ${v.suggestion.price.toFixed(0)}` : 'no cost entered'}
										</div>
										<input
											class="input h-8 py-1 text-sm w-24 min-w-0 font-semibold"
											type="number" min="0" step="1"
											value={v.finalPrice}
											oninput={(e) => onPriceOverrideInput(v, product.id, e.currentTarget.value)}
										/>
										<div class="h-4 mt-0.5">
											{#if v.priceOverridden && Math.round(v.finalPrice) !== Math.round(v.currentPrice)}
												<button type="button" class="text-xs text-muted-foreground underline" onclick={() => resetPriceOverride(v, product.id)}>
													reset (Rs {v.currentPrice.toFixed(0)})
												</button>
											{/if}
										</div>
									</Table.Cell>

									<Table.Cell class="align-top">
										<div class="h-4 mb-1 text-xs text-muted-foreground truncate">
											{v.suggestion ? `Suggested Rs ${v.suggestion.compareAtPrice.toFixed(0)}` : 'no cost entered'}
										</div>
										<input
											class="input h-8 py-1 text-sm w-24 min-w-0 font-semibold"
											type="number" min="0" step="1"
											value={v.finalCompareAtPrice}
											oninput={(e) => onCompareAtOverrideInput(v, product.id, e.currentTarget.value)}
										/>
										<div class="h-4 mt-0.5">
											{#if v.compareAtOverridden && Math.round(v.finalCompareAtPrice) !== Math.round(v.currentCompareAtPrice ?? 0)}
												<button type="button" class="text-xs text-muted-foreground underline" onclick={() => resetCompareAtOverride(v, product.id)}>
													reset (Rs {(v.currentCompareAtPrice ?? 0).toFixed(0)})
												</button>
											{/if}
										</div>
									</Table.Cell>

									<Table.Cell class="align-top">
										<div class="h-4 mb-1"></div>
										{#if savingVariants.has(v.id)}
											<Loader2Icon class="size-3.5 animate-spin text-muted-foreground" />
										{:else if v.pending}
											<span class="badge badge-pending">Changed</span>
										{/if}
										<div class="h-4 mt-0.5"></div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</div>
			{/each}
			</div>
		</div>

		<div class="lg:sticky lg:top-4 self-start">
			{#if hasPendingChanges}
				<div class="card border-amber-300 bg-amber-50 p-4">
					<p class="text-sm text-amber-800 mb-3">Some final prices differ from what's live on Shopify.</p>
					<Button href="/admin/stores/{storeId}/pricing/review" size="sm" class="w-full">
						Review changes <ArrowRightIcon class="size-4" />
					</Button>
				</div>
			{:else}
				<div class="card p-4 text-xs text-muted-foreground">No pending changes yet.</div>
			{/if}

			<div class="card p-4 mt-4">
				<p class="text-xs text-muted-foreground mb-3">Clear every "Reviewed" tick on this page.</p>
				<Button variant="outline" size="sm" class="w-full" onclick={() => { resetConfirmOpen = true; resetConfirmText = ''; }}>
					Reset all ticks
				</Button>
			</div>
		</div>
	</div>
</div>

<Dialog.Root open={resetConfirmOpen} onOpenChange={(o) => { if (!o) resetConfirmOpen = false; }}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Reset all review ticks?</Dialog.Title>
			<Dialog.Description>
				Un-ticks "Reviewed" on every product card for this store. Type <span class="font-mono font-semibold">reset</span> to confirm.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-1.5">
			<Label for="reset-confirm">Confirmation</Label>
			<input id="reset-confirm" class="input" autocomplete="off" placeholder="reset" bind:value={resetConfirmText} />
		</div>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => resetConfirmOpen = false}>Cancel</Button>
			<Button type="button" disabled={!resetConfirmed || resettingAll} onclick={resetAllReviewed}>
				{#if resettingAll}<Loader2Icon class="size-4 animate-spin" />{/if}
				Reset all ticks
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={bulkEditProductId !== null} onOpenChange={(o) => { if (!o) bulkEditProductId = null; }}>
	<Dialog.Content class="sm:max-w-sm data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8">
		<Dialog.Header>
			<Dialog.Title>Bulk edit</Dialog.Title>
			<Dialog.Description>
				Applies to every variant on this product only. Leave a field blank to keep each variant's current value.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-1.5">
				<Label for="bulk-weight">Weight (g)</Label>
				<input id="bulk-weight" class="input" type="number" min="0" step="1" placeholder="Keep current" bind:value={bulkWeight} />
			</div>
			<div class="space-y-1.5">
				<Label for="bulk-cost">Buying cost</Label>
				<div class="flex gap-1">
					<input id="bulk-cost" class="input" type="number" min="0" step="0.01" placeholder="Keep current" bind:value={bulkCostAmount} />
					<select class="input w-24 shrink-0 px-1" bind:value={bulkCostCurrency}>
						<option value="cny">CNY</option>
						<option value="pkr">PKR</option>
					</select>
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="bulk-price">Final price</Label>
				<input id="bulk-price" class="input" type="number" min="0" step="1" placeholder="Keep current" bind:value={bulkPrice} />
				<p class="text-xs text-muted-foreground">
					{bulkSuggestion ? `Suggested Rs ${bulkSuggestion.price.toFixed(0)}` : 'Enter weight & cost above to see a suggestion'}
				</p>
			</div>
			<div class="space-y-1.5">
				<Label for="bulk-compareAt">Final compare-at</Label>
				<input id="bulk-compareAt" class="input" type="number" min="0" step="1" placeholder="Keep current" bind:value={bulkCompareAt} />
				<p class="text-xs text-muted-foreground">
					{bulkSuggestion ? `Suggested Rs ${bulkSuggestion.compareAtPrice.toFixed(0)}` : 'Enter weight & cost above to see a suggestion'}
				</p>
			</div>
		</div>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => bulkEditProductId = null}>Cancel</Button>
			<Button type="button" onclick={applyBulkEdit}>Apply to all variants</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
