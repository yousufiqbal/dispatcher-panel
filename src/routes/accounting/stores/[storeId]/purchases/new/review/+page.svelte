<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getDraftLines, getDraftHeader, clearDraft } from '../draft.svelte';
	import type { ActionData } from '../$types';

	let { form }: { form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);

	const lines = getDraftLines();
	const header = getDraftHeader();
	let submitting = $state(false);

	$effect(() => {
		if (lines.length === 0) goto(`/accounting/stores/${storeId}/purchases/new`);
	});

	const total = $derived(lines.reduce((sum, l) => sum + (parseFloat(l.unitCost) || 0) * l.quantity, 0));
</script>

<svelte:head><title>Review Purchase — Accounting</title></svelte:head>

<div class="p-3 sm:p-6 max-w-2xl mx-auto">
	<a href="/accounting/stores/{storeId}/purchases/new" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-4 w-fit">
		<ArrowLeftIcon class="size-4" />
		Back to edit
	</a>
	<h1 class="text-xl font-bold text-foreground mb-1">Review Purchase</h1>
	<p class="text-sm text-muted-foreground mb-6">Check everything before saving — this increases Shopify on-hand stock for each line below.</p>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-5">{form.error}</div>
	{/if}

	<div class="card p-5 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
		<div>
			<div class="text-xs text-muted-foreground uppercase tracking-wide">Supplier</div>
			<div class="text-foreground font-medium">{header.supplier || '—'}</div>
		</div>
		<div>
			<div class="text-xs text-muted-foreground uppercase tracking-wide">Date</div>
			<div class="text-foreground font-medium">{header.purchaseDate}</div>
		</div>
		<div>
			<div class="text-xs text-muted-foreground uppercase tracking-wide">Note</div>
			<div class="text-foreground font-medium">{header.note || '—'}</div>
		</div>
	</div>

	<div class="card overflow-hidden divide-y divide-border mb-3">
		{#each lines as line}
			<div class="flex items-center gap-3 px-4 py-3">
				{#if line.imageUrl}
					<img src={line.imageUrl} alt="" class="size-10 rounded object-cover border border-border shrink-0" />
				{:else}
					<div class="size-10 rounded bg-muted shrink-0"></div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="text-sm font-medium text-foreground truncate">{line.productTitle}{line.variantTitle ? ` · ${line.variantTitle}` : ''}</div>
					<div class="text-xs text-muted-foreground">{line.sku || 'no sku'} · qty {line.quantity} @ {parseFloat(line.unitCost || '0').toFixed(2)}</div>
				</div>
				<div class="text-sm font-semibold text-foreground shrink-0 tabular-nums">
					{((parseFloat(line.unitCost) || 0) * line.quantity).toFixed(2)}
				</div>
			</div>
		{/each}
	</div>

	<div class="flex items-center justify-between px-1 mb-6">
		<span class="text-sm font-semibold text-foreground">Total</span>
		<span class="text-sm font-semibold text-foreground tabular-nums">{total.toFixed(2)}</span>
	</div>

	<form
		method="POST"
		action="/accounting/stores/{storeId}/purchases/new"
		use:enhance={() => {
			submitting = true;
			return async ({ update, result }) => {
				await update();
				if (result.type === 'redirect') clearDraft();
				submitting = false;
			};
		}}
	>
		<input type="hidden" name="supplier" value={header.supplier} />
		<input type="hidden" name="purchaseDate" value={header.purchaseDate} />
		<input type="hidden" name="note" value={header.note} />
		{#each lines as line}
			<input type="hidden" name="variantId" value={line.variantId} />
			<input type="hidden" name="productId" value={line.productId} />
			<input type="hidden" name="productTitle" value={line.productTitle} />
			<input type="hidden" name="variantTitle" value={line.variantTitle ?? ''} />
			<input type="hidden" name="sku" value={line.sku} />
			<input type="hidden" name="quantity" value={line.quantity} />
			<input type="hidden" name="unitCost" value={line.unitCost} />
		{/each}

		<div class="flex items-center gap-3">
			<Button type="submit" disabled={submitting}>
				{#if submitting}<Loader2Icon class="size-4 animate-spin" />{/if}
				Save Purchase
			</Button>
			<Button type="button" variant="secondary" href="/accounting/stores/{storeId}/purchases/new">Back</Button>
		</div>
	</form>
</div>
