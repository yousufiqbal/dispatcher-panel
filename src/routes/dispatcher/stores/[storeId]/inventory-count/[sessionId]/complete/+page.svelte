<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import DownloadIcon from '@lucide/svelte/icons/download';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);

	function thumbUrl(url: string | null | undefined): string {
		if (!url) return '';
		return url.includes('cdn.shopify.com') ? `${url}?width=88` : url;
	}

	function exportCSV() {
		const headers = ['Product', 'Variant', 'SKU', 'System Stock', 'Counted Stock', 'Delta'];
		const rows = data.checkedItems.map((i) => [
			i.productTitle, i.variantTitle ?? '', i.sku ?? '', i.currentStock, i.newStock, (i.newStock ?? 0) - i.currentStock
		]);
		const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `inventory-count-${data.storeName}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head><title>Inventory Count Report — {data.storeName}</title></svelte:head>

<div class="min-h-screen bg-zinc-50">
	<div class="max-w-2xl mx-auto px-4 py-8">
		<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
			<div>
				<a href="/dispatcher/stores/{storeId}/inventory-count" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2 w-fit">
					<ArrowLeftIcon class="size-4" />
					Sessions
				</a>
				<h1 class="text-xl font-bold text-foreground">Inventory Count Report</h1>
				<p class="text-sm text-muted-foreground mt-1">
					<span class="font-medium text-foreground">{data.checkedItems.length}</span> {data.checkedItems.length === 1 ? 'variant' : 'variants'} differ from system stock
				</p>
			</div>
			<Button variant="outline" onclick={exportCSV} disabled={data.checkedItems.length === 0}>
				<DownloadIcon class="size-4" />
				Export CSV
			</Button>
		</div>

		<div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 mb-5">
			This is a report only — nothing was changed in Shopify. Apply these counts yourself in the Shopify admin.
		</div>

		{#if data.checkedItems.length === 0}
			<div class="card border-dashed p-10 text-center">
				<p class="text-sm text-muted-foreground">No items counted yet, or every count matched the system stock.</p>
				<Button href="/dispatcher/stores/{storeId}/inventory-count/{data.session.id}/0" class="mt-4">
					Start counting
				</Button>
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
						</div>
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
