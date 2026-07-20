<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import CheckIcon from '@lucide/svelte/icons/check';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);
	const storeName = $derived(data.storeName);

	// Local ordered state — plain object so $state tracks property writes
	let ordered = $state<Record<string, boolean>>(
		Object.fromEntries(data.restockList.map((i) => [i.id, !!i.orderedAt]))
	);
	const orderedCount = $derived(Object.values(ordered).filter(Boolean).length);

	function thumbUrl(url: string | null | undefined): string {
		if (!url) return '';
		if (url.includes('cdn.shopify.com')) {
			const u = new URL(url);
			u.searchParams.set('width', '88');
			return u.toString();
		}
		return url;
	}

	function exportCSV() {
		const headers = ['Product', 'Variant', 'SKU', 'Restock Qty'];
		const rows = data.restockList.map((i) => [i.productTitle, i.variantTitle ?? '', i.sku ?? '', i.actualRestock ?? 0]);
		const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `restock-${storeName}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head><title>Restock List — {storeName}</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
		<div>
			<a href="/dispatcher/stores/{storeId}/restock" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2 w-fit">
				<ArrowLeftIcon class="size-4" />
				Sessions
			</a>
			<h1 class="text-xl font-bold text-foreground">Restock List</h1>
			<p class="text-sm text-muted-foreground mt-1">
				<span class="font-medium text-foreground">{data.restockList.length}</span> items
				{#if orderedCount > 0}· <span class="text-green-700 font-medium">{orderedCount} ordered</span>{:else}· 0 ordered{/if}
			</p>
		</div>
		<Button variant="outline" onclick={exportCSV} disabled={data.restockList.length === 0}>
			<DownloadIcon class="size-4" />
			Export CSV
		</Button>
	</div>

	{#if data.restockList.length === 0}
		<div class="card border-dashed p-12 text-center">
			<p class="text-sm font-medium text-foreground">No items to restock</p>
			<p class="text-xs text-muted-foreground mt-1">No variants had an actual restock quantity greater than 0</p>
		</div>
	{:else}
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.restockList as item (item.id)}
				{@const isOrdered = ordered[item.id] ?? false}
				<div class="flex items-center gap-3 px-4 py-3 transition-colors {isOrdered ? 'bg-green-50/60' : ''}">
					{#if item.variantImageUrl ?? item.productImageUrl}
						<img src={thumbUrl(item.variantImageUrl ?? item.productImageUrl)} alt="" class="size-11 object-cover rounded-lg border border-border bg-muted shrink-0" />
					{:else}
						<div class="size-11 rounded-lg bg-muted shrink-0"></div>
					{/if}
					<div class="min-w-0 flex-1">
						<div class="text-sm font-medium text-foreground truncate">{item.productTitle}</div>
						{#if item.variantTitle}<div class="text-xs text-muted-foreground truncate">{item.variantTitle}</div>{/if}
					</div>
					<span class="shrink-0 inline-flex items-center justify-center size-8 {isOrdered ? 'bg-green-600' : 'bg-foreground'} text-background text-xs font-bold rounded-lg tabular-nums">
						{item.actualRestock}
					</span>
					<form method="POST" action="?/toggleOrdered" use:enhance={() => { ordered[item.id] = !isOrdered; return async () => {}; }}>
						<input type="hidden" name="id" value={item.id} />
						<Button type="submit" variant="outline" size="icon" title={isOrdered ? 'Mark as not ordered' : 'Mark as ordered'} class="size-8 shrink-0 {isOrdered ? 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200' : ''}">
							<CheckIcon class="size-4" />
						</Button>
					</form>
				</div>
			{/each}
		</div>
	{/if}
</div>
