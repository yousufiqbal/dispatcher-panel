<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check';
	import { getDraftLines, setDraftLines, getDraftHeader, setDraftHeader, type DraftLine } from './draft.svelte';

	const storeId = $derived($page.params.storeId);

	interface VariantResult {
		variantId: string;
		productId: string;
		productTitle: string;
		variantTitle: string | null;
		sku: string;
		imageUrl: string | null;
	}

	const todayStr = new Date().toISOString().slice(0, 10);
	const existingHeader = getDraftHeader();

	let lines = $state<DraftLine[]>(getDraftLines());
	let supplier = $state(existingHeader.supplier);
	let purchaseDate = $state(existingHeader.purchaseDate || todayStr);
	let note = $state(existingHeader.note);

	let query = $state('');
	let results = $state<VariantResult[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;

	function onQueryInput() {
		clearTimeout(searchTimer);
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

	function addLine(v: VariantResult) {
		lines = [
			...lines,
			{
				key: crypto.randomUUID(),
				variantId: v.variantId,
				productId: v.productId,
				productTitle: v.productTitle,
				variantTitle: v.variantTitle,
				sku: v.sku,
				imageUrl: v.imageUrl,
				quantity: 1,
				unitCost: ''
			}
		];
		query = '';
		results = [];
	}

	function removeLine(key: string) {
		lines = lines.filter((l) => l.key !== key);
	}

	const total = $derived(lines.reduce((sum, l) => sum + (parseFloat(l.unitCost) || 0) * l.quantity, 0));

	function goReview() {
		setDraftLines(lines);
		setDraftHeader({ supplier, purchaseDate, note });
		goto(`/accounting/stores/${storeId}/purchases/new/review`);
	}
</script>

<svelte:head><title>Add Purchase — Accounting</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	<a href="/accounting/stores/{storeId}/purchases" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-4 w-fit">
		<ArrowLeftIcon class="size-4" />
		Purchases
	</a>
	<h1 class="text-xl font-bold text-foreground mb-1">Add Purchase</h1>
	<p class="text-sm text-muted-foreground mb-6">Add every SKU from one supplier invoice, then review before saving.</p>

	<div class="space-y-6">
		<div class="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div class="space-y-1.5">
				<Label for="supplier">Supplier (optional)</Label>
				<Input id="supplier" bind:value={supplier} placeholder="Acme Traders" />
			</div>
			<div class="space-y-1.5">
				<Label for="purchaseDate">Purchase Date</Label>
				<Input id="purchaseDate" type="date" bind:value={purchaseDate} required />
			</div>
			<div class="space-y-1.5">
				<Label for="note">Note (optional)</Label>
				<Input id="note" bind:value={note} placeholder="Invoice #, etc." />
			</div>
		</div>

		<div>
			<Label>Add a product</Label>
			<div class="relative mt-1.5">
				<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<Input bind:value={query} oninput={onQueryInput} placeholder="Search by title or SKU…" class="pl-9" autocomplete="off" />
				{#if searching}<Loader2Icon class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />{/if}
			</div>
			{#if results.length > 0}
				<div class="mt-1.5 bg-card border border-border rounded-lg shadow-sm max-h-72 overflow-y-auto">
					{#each results as v}
						<button type="button" class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors" onclick={() => addLine(v)}>
							{#if v.imageUrl}
								<img src={v.imageUrl} alt="" class="size-8 rounded object-cover border border-border shrink-0" />
							{:else}
								<div class="size-8 rounded bg-muted shrink-0"></div>
							{/if}
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-foreground truncate">{v.productTitle}{v.variantTitle ? ` · ${v.variantTitle}` : ''}</div>
								<div class="text-xs text-muted-foreground">{v.sku || 'no sku'}</div>
							</div>
							<PlusIcon class="size-4 text-muted-foreground shrink-0" />
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if lines.length === 0}
			<div class="card border-dashed p-8 text-center">
				<p class="text-sm text-muted-foreground">No items added yet. Search above to add the first one.</p>
			</div>
		{:else}
			<div class="card overflow-hidden divide-y divide-border">
				{#each lines as line (line.key)}
					<div class="flex items-center gap-3 px-4 py-3">
						{#if line.imageUrl}
							<img src={line.imageUrl} alt="" class="size-10 rounded object-cover border border-border shrink-0" />
						{:else}
							<div class="size-10 rounded bg-muted shrink-0"></div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-foreground truncate">{line.productTitle}{line.variantTitle ? ` · ${line.variantTitle}` : ''}</div>
							<div class="text-xs text-muted-foreground">{line.sku || 'no sku'}</div>
						</div>
						<div class="w-20 shrink-0">
							<Input type="number" min="1" step="1" bind:value={line.quantity} aria-label="Quantity" />
						</div>
						<div class="w-28 shrink-0">
							<Input type="number" min="0" step="0.01" placeholder="Unit cost" bind:value={line.unitCost} aria-label="Unit cost" />
						</div>
						<div class="w-24 text-sm font-medium text-foreground text-right shrink-0 tabular-nums">
							{((parseFloat(line.unitCost) || 0) * line.quantity).toFixed(2)}
						</div>
						<Button type="button" variant="ghost" size="icon" class="text-muted-foreground hover:text-destructive shrink-0" onclick={() => removeLine(line.key)}>
							<Trash2Icon class="size-4" />
						</Button>
					</div>
				{/each}
			</div>

			<div class="flex items-center justify-between px-1">
				<span class="text-sm font-semibold text-foreground">Total</span>
				<span class="text-sm font-semibold text-foreground tabular-nums">{total.toFixed(2)}</span>
			</div>
		{/if}

		<div class="flex items-center gap-3">
			<Button onclick={goReview} disabled={lines.length === 0 || !purchaseDate}>
				<ClipboardCheckIcon class="size-4" />
				Review Purchase
			</Button>
			<Button type="button" variant="secondary" href="/accounting/stores/{storeId}/purchases">Cancel</Button>
		</div>
	</div>
</div>
