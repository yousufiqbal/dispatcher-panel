<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { formatCurrency, formatDateShort } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);

	interface VariantResult {
		variantId: string;
		productId: string;
		productTitle: string;
		variantTitle: string | null;
		sku: string;
		imageUrl: string | null;
		onHand: number;
	}

	let showAdd = $state(false);
	let query = $state('');
	let results = $state<VariantResult[]>([]);
	let searching = $state(false);
	let selected = $state<VariantResult | null>(null);
	let searchTimer: ReturnType<typeof setTimeout>;

	function onQueryInput() {
		clearTimeout(searchTimer);
		selected = null;
		if (!query.trim()) { results = []; return; }
		searchTimer = setTimeout(async () => {
			searching = true;
			try {
				const res = await fetch(`/api/accounting/stores/${storeId}/variant-search?q=${encodeURIComponent(query)}`);
				const body = await res.json();
				results = body.results ?? [];
			} finally {
				searching = false;
			}
		}, 300);
	}

	function pick(v: VariantResult) {
		selected = v;
		results = [];
		query = `${v.productTitle}${v.variantTitle ? ' - ' + v.variantTitle : ''}`;
	}

	function resetForm() {
		selected = null;
		query = '';
		results = [];
	}

	const todayStr = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>Purchases — {data.storeName}</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h2 class="text-sm font-semibold text-foreground">Recent Purchases</h2>
			<p class="text-xs text-muted-foreground mt-0.5">Increases real Shopify inventory (on hand) at the store's location</p>
		</div>
		<Button size="sm" onclick={() => { resetForm(); showAdd = true; }}>
			<PlusIcon class="size-4" />
			Add Purchase
		</Button>
	</div>

	{#if data.purchases.length === 0}
		<div class="card border-dashed p-8 text-center">
			<p class="text-sm text-muted-foreground">No purchases recorded yet.</p>
		</div>
	{:else}
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.purchases as p}
				<div class="flex items-center gap-3 px-4 py-3">
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium text-foreground truncate">{p.productTitle}{p.variantTitle ? ` · ${p.variantTitle}` : ''}</div>
						<div class="text-xs text-muted-foreground">
							{p.sku ?? 'no sku'} · qty {p.quantity} @ {formatCurrency(p.unitCost, 'PKR')} · {formatDateShort(p.purchaseDate.toString())}
						</div>
						{#if p.shopifyAdjustmentStatus === 'failed'}
							<div class="text-xs text-destructive mt-0.5">⚠ Shopify stock update failed for this entry</div>
						{/if}
					</div>
					<div class="text-sm font-semibold text-foreground shrink-0">{formatCurrency(p.totalCost, 'PKR')}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Dialog.Root bind:open={showAdd}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add Purchase</Dialog.Title>
			<Dialog.Description>Records the purchase and increases Shopify on-hand stock for this variant.</Dialog.Description>
		</Dialog.Header>
		{#if form?.error}
			<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
		{/if}
		<form
			method="POST"
			action="?/addPurchase"
			use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') {
					showAdd = false;
					addToast(form?.warning ?? 'Purchase recorded');
				}
			}}
			class="space-y-4"
		>
			<div class="space-y-1.5 relative">
				<Label for="variant-search">Product / Variant</Label>
				<div class="relative">
					<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input id="variant-search" bind:value={query} oninput={onQueryInput} placeholder="Search by title or SKU…" class="pl-9" autocomplete="off" />
				</div>
				{#if results.length > 0}
					<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
						{#each results as v}
							<button type="button" class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors" onclick={() => pick(v)}>
								{#if v.imageUrl}
									<img src={v.imageUrl} alt="" class="size-8 rounded object-cover border border-border shrink-0" />
								{:else}
									<div class="size-8 rounded bg-muted shrink-0"></div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium text-foreground truncate">{v.productTitle}{v.variantTitle ? ` · ${v.variantTitle}` : ''}</div>
									<div class="text-xs text-muted-foreground">{v.sku || 'no sku'} · on hand {v.onHand}</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
				{#if selected}
					<div class="flex items-center gap-1.5 text-xs text-green-700 mt-1">
						<CheckIcon class="size-3.5" />
						Selected — currently {selected.onHand} on hand
					</div>
				{/if}
			</div>

			{#if selected}
				<input type="hidden" name="variantId" value={selected.variantId} />
				<input type="hidden" name="productId" value={selected.productId} />
				<input type="hidden" name="productTitle" value={selected.productTitle} />
				<input type="hidden" name="variantTitle" value={selected.variantTitle ?? ''} />
				<input type="hidden" name="sku" value={selected.sku} />
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="quantity">Quantity</Label>
					<Input id="quantity" name="quantity" type="number" min="1" step="1" required />
				</div>
				<div class="space-y-1.5">
					<Label for="unitCost">Unit Cost</Label>
					<Input id="unitCost" name="unitCost" type="number" min="0" step="0.01" required />
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="purchaseDate">Purchase Date</Label>
				<Input id="purchaseDate" name="purchaseDate" type="date" value={todayStr} required />
			</div>
			<div class="space-y-1.5">
				<Label for="note">Note (optional)</Label>
				<Input id="note" name="note" placeholder="Supplier, invoice #, etc." />
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => showAdd = false}>Cancel</Button>
				<Button type="submit" disabled={!selected}>Add Purchase</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
