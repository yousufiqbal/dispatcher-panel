<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import UploadCloudIcon from '@lucide/svelte/icons/cloud-upload';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);
	const sessionId = $derived($page.params.sessionId);

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');
	function openImage(url: string | null | undefined, alt: string) {
		if (!url) return;
		lightboxUrl = url;
		lightboxAlt = alt;
	}

	// Apply flow: confirm → run batches of 25 through the JSON endpoint,
	// updating the progress bar after each → summary. The dialog stays open
	// for the whole thing; closing is blocked mid-run.
	const BATCH = 25;
	type Phase = 'confirm' | 'running' | 'done';
	let confirmApply = $state(false);
	let phase = $state<Phase>('confirm');
	let progress = $state({ done: 0, total: 0, applied: 0, failed: 0 });
	let runError = $state<string | null>(null);
	const applying = $derived(phase === 'running');
	const percent = $derived(progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100));

	function openConfirm() {
		phase = 'confirm';
		runError = null;
		confirmApply = true;
	}

	async function runApply() {
		const ids = data.checkedItems.filter((i) => !i.appliedAt).map((i) => i.id);
		const batches: string[][] = [];
		for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

		phase = 'running';
		progress = { done: 0, total: ids.length, applied: 0, failed: 0 };
		runError = null;

		for (let b = 0; b < batches.length; b++) {
			try {
				const res = await fetch(`/dispatcher/stores/${storeId}/inventory-count/${sessionId}/apply`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ itemIds: batches[b], batch: b + 1, totalBatches: batches.length })
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const r: { applied: string[]; failed: { id: string; error: string }[] } = await res.json();
				progress.applied += r.applied.length;
				progress.failed += r.failed.length;
			} catch (e) {
				// Network/server failure — count the whole batch as failed and keep
				// going; per-row errors for the rest are still recorded server-side.
				progress.failed += batches[b].length;
				runError = e instanceof Error ? e.message : 'Request failed';
			}
			progress.done += batches[b].length;
		}

		await invalidateAll();
		phase = 'done';
	}

	const netUnits = $derived(data.checkedItems.filter((i) => !i.appliedAt).reduce((sum, i) => sum + (i.newStock! - i.currentStock), 0));
	const pendingCount = $derived(data.checkedItems.filter((i) => !i.appliedAt).length);
	const appliedCount = $derived(data.checkedItems.filter((i) => i.appliedAt).length);
	const failedCount = $derived(data.checkedItems.filter((i) => !i.appliedAt && i.applyError).length);

	function thumbUrl(url: string | null | undefined): string {
		if (!url) return '';
		return url.includes('cdn.shopify.com') ? `${url}?width=88` : url;
	}
</script>

<svelte:head><title>Inventory Audit Report — {data.storeName}</title></svelte:head>

<div class="min-h-screen bg-zinc-50">
	<div class="max-w-2xl mx-auto px-4 py-8">
		<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
			<div>
				<a href="/dispatcher/stores/{storeId}/inventory-count" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2 w-fit">
					<ArrowLeftIcon class="size-4" />
					Sessions
				</a>
				<h1 class="text-xl font-bold text-foreground">Inventory Audit Report</h1>
				<p class="text-sm text-muted-foreground mt-1">
					<span class="font-medium text-foreground">{data.checkedItems.length}</span> {data.checkedItems.length === 1 ? 'variant' : 'variants'} differ from system stock
				</p>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<Button type="button" disabled={applying || pendingCount === 0} onclick={openConfirm}>
					{#if applying}
						<Loader2Icon class="size-4 animate-spin" />
						Applying…
					{:else}
						<UploadCloudIcon class="size-4" />
						Apply to Shopify{pendingCount > 0 ? ` (${pendingCount})` : ''}
					{/if}
				</Button>
			</div>
		</div>

		<div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 mb-5">
			{#if data.session.appliedAt}
				Applied to Shopify on {new Date(data.session.appliedAt).toLocaleString()}. This session is locked — counts can't be edited and it can't be deleted.{#if pendingCount > 0} {pendingCount} {pendingCount === 1 ? 'variant' : 'variants'} failed and can be retried with Apply.{/if}
			{:else}
				Nothing changes in Shopify until you click "Apply to Shopify". It pushes each variant's counted <em>difference</em>, so orders fulfilled since the count are not undone.
			{/if}
		</div>

		{#if data.skippedProducts.length > 0}
			<div class="card overflow-hidden mb-5">
				<div class="px-4 py-2.5 border-b border-border bg-amber-50/50 flex items-center gap-2">
					<EyeOffIcon class="size-4 text-amber-600" />
					<span class="text-sm font-semibold text-foreground">{data.skippedProducts.length} skipped — not yet counted</span>
				</div>
				<div class="divide-y divide-border">
					{#each data.skippedProducts as p}
						<div class="flex items-center gap-3 px-4 py-3">
							{#if p.productImageUrl}
								<button type="button" class="shrink-0 cursor-zoom-in" onclick={() => openImage(p.productImageUrl, p.productTitle)}>
									<img src={thumbUrl(p.productImageUrl)} alt="" class="size-9 object-cover rounded-lg border border-border bg-muted" />
								</button>
							{:else}
								<div class="size-9 rounded-lg bg-muted shrink-0"></div>
							{/if}
							<div class="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{p.productTitle}</div>
							{#if !data.session.appliedAt}
								<Button variant="outline" size="sm" href="/dispatcher/stores/{storeId}/inventory-count/{data.session.id}/{p.position}" class="shrink-0">
									Recount
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if data.checkedItems.length === 0}
			<div class="card border-dashed p-10 text-center">
				<p class="text-sm text-muted-foreground">No items counted yet, or every count matched the system stock.</p>
				{#if !data.session.appliedAt}
					<Button href="/dispatcher/stores/{storeId}/inventory-count/{data.session.id}/0" class="mt-4">
						Start counting
					</Button>
				{/if}
			</div>
		{:else}
			<div class="card overflow-hidden divide-y divide-border">
				{#each data.checkedItems as item}
					<div class="flex items-center gap-3 px-4 py-3">
						{#if item.variantImageUrl ?? item.productImageUrl}
							<button type="button" class="shrink-0 cursor-zoom-in" onclick={() => openImage(item.variantImageUrl ?? item.productImageUrl, item.variantTitle ? `${item.productTitle} — ${item.variantTitle}` : item.productTitle)}>
								<img src={thumbUrl(item.variantImageUrl ?? item.productImageUrl)} alt="" class="size-9 object-cover rounded-lg border border-border bg-muted" />
							</button>
						{:else}
							<div class="size-9 rounded-lg bg-muted shrink-0"></div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-foreground truncate">{item.productTitle}</div>
							{#if item.variantTitle}<div class="text-xs text-muted-foreground">{item.variantTitle}</div>{/if}
							{#if !item.appliedAt && item.applyError}
								<div class="text-xs text-red-600 flex items-center gap-1 mt-0.5"><AlertCircleIcon class="size-3" />{item.applyError}</div>
							{/if}
						</div>
						{#if item.appliedAt}
							<span class="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 shrink-0" title="Applied {new Date(item.appliedAt).toLocaleString()}">
								<CheckIcon class="size-3" /> Applied
							</span>
						{/if}
						<div class="flex items-center gap-2 shrink-0 text-sm tabular-nums">
							<span class="text-muted-foreground">{item.currentStock}</span>
							<ArrowLeftIcon class="size-3.5 text-muted-foreground/50 rotate-180" />
							<span class="font-semibold {item.newStock! > item.currentStock ? 'text-green-700' : item.newStock! < item.currentStock ? 'text-red-600' : 'text-foreground'}">{item.newStock}</span>
							<span class="text-xs {item.newStock! > item.currentStock ? 'text-green-600' : 'text-red-500'}">
								({item.newStock! > item.currentStock ? '+' : ''}{item.newStock! - item.currentStock})
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<Dialog.Root open={confirmApply} onOpenChange={(open) => { if (!open && phase !== 'running') confirmApply = false; }}>
	<Dialog.Content class="sm:max-w-md" onInteractOutside={(e) => { if (phase === 'running') e.preventDefault(); }} onEscapeKeydown={(e) => { if (phase === 'running') e.preventDefault(); }}>
		{#if phase === 'confirm'}
			<Dialog.Header>
				<Dialog.Title>Apply {pendingCount} {pendingCount === 1 ? 'change' : 'changes'} to Shopify?</Dialog.Title>
				<Dialog.Description>
					Each variant's on-hand stock is adjusted by its counted difference — not overwritten — so orders fulfilled since the count stay correct.
				</Dialog.Description>
			</Dialog.Header>
			<div class="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1">
				<div class="flex justify-between"><span class="text-muted-foreground">Variants</span><span class="font-medium tabular-nums">{pendingCount}</span></div>
				<div class="flex justify-between"><span class="text-muted-foreground">Net units</span><span class="font-medium tabular-nums {netUnits > 0 ? 'text-green-700' : netUnits < 0 ? 'text-red-600' : ''}">{netUnits > 0 ? '+' : ''}{netUnits}</span></div>
			</div>
			<p class="text-xs text-muted-foreground">This is recorded in the activity log under your name. Once applied, the session is locked and cannot be edited or deleted.</p>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => confirmApply = false}>Cancel</Button>
				<Button onclick={runApply}>
					<UploadCloudIcon class="size-4" />
					Apply to Shopify
				</Button>
			</Dialog.Footer>
		{:else if phase === 'running'}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					<Loader2Icon class="size-4 animate-spin" />
					Applying to Shopify…
				</Dialog.Title>
				<Dialog.Description>Don't close this page. Each batch is saved as it completes.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-2">
				<div class="h-2 w-full rounded-full bg-muted overflow-hidden">
					<div class="h-full bg-primary transition-[width] duration-300" style="width: {percent}%"></div>
				</div>
				<div class="flex justify-between text-xs text-muted-foreground tabular-nums">
					<span>{progress.done} / {progress.total} variants</span>
					<span>{percent}%</span>
				</div>
				{#if progress.failed > 0}
					<p class="text-xs text-red-600">{progress.failed} failed so far</p>
				{/if}
			</div>
		{:else}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					{#if progress.failed === 0}
						<CheckIcon class="size-4 text-green-600" />
						Applied to Shopify
					{:else}
						<AlertCircleIcon class="size-4 text-amber-600" />
						Applied with errors
					{/if}
				</Dialog.Title>
			</Dialog.Header>
			<div class="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1">
				<div class="flex justify-between"><span class="text-muted-foreground">Adjusted</span><span class="font-medium tabular-nums text-green-700">{progress.applied}</span></div>
				<div class="flex justify-between"><span class="text-muted-foreground">Failed</span><span class="font-medium tabular-nums {progress.failed > 0 ? 'text-red-600' : ''}">{progress.failed}</span></div>
			</div>
			{#if runError}
				<p class="text-xs text-red-600">{runError}</p>
			{/if}
			{#if progress.failed > 0}
				<p class="text-xs text-muted-foreground">Failed rows show their error in the list. Click "Apply to Shopify" again to retry just those.</p>
			{/if}
			<Dialog.Footer>
				<Button onclick={() => confirmApply = false}>Done</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Lightbox bind:url={lightboxUrl} alt={lightboxAlt} />
