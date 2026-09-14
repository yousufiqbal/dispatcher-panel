<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import UploadCloudIcon from '@lucide/svelte/icons/cloud-upload';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	let { data, form } = $props();
	const storeId = $derived($page.params.storeId);

	let applying = $state(false);
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
				<form
					method="POST"
					action="?/apply"
					use:enhance={({ cancel }) => {
						const msg = `Push ${pendingCount} inventory ${pendingCount === 1 ? 'change' : 'changes'} to Shopify?

Each variant is adjusted by its counted difference (delta), not overwritten. This is logged under your name.`;
						if (!confirm(msg)) { cancel(); return; }
						applying = true;
						return async ({ update }) => { await update(); applying = false; };
					}}
				>
					<Button type="submit" disabled={applying || pendingCount === 0}>
						{#if applying}
							<Loader2Icon class="size-4 animate-spin" />
							Applying…
						{:else}
							<UploadCloudIcon class="size-4" />
							Apply to Shopify{pendingCount > 0 ? ` (${pendingCount})` : ''}
						{/if}
					</Button>
				</form>
			</div>
		</div>

		{#if form?.error}
			<div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900 mb-5">{form.error}</div>
		{:else if form && 'applied' in form && form.failed != null}
			<div class="rounded-lg {form.failed > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900'} border px-4 py-3 text-sm mb-5">
				{form.applied} {form.applied === 1 ? 'variant' : 'variants'} adjusted in Shopify{form.failed > 0 ? `, ${form.failed} failed — see rows below, then click Apply again to retry.` : '.'}
			</div>
		{/if}

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
								<img src={thumbUrl(p.productImageUrl)} alt="" class="size-9 object-cover rounded-lg border border-border bg-muted shrink-0" />
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
							<img src={thumbUrl(item.variantImageUrl ?? item.productImageUrl)} alt="" class="size-9 object-cover rounded-lg border border-border bg-muted shrink-0" />
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
