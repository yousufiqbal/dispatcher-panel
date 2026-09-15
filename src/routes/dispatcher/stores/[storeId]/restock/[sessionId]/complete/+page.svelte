<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import CheckIcon from '@lucide/svelte/icons/check';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';

	let { data } = $props();
	const sessionId = $derived($page.params.sessionId);
	const storeId = $derived($page.params.storeId);
	const storeName = $derived(data.storeName);

	// Local ordered state — plain object so $state tracks property writes
	let ordered = $state<Record<string, boolean>>(
		Object.fromEntries(data.restockList.map((i) => [i.id, !!i.orderedAt]))
	);
	const orderedCount = $derived(Object.values(ordered).filter(Boolean).length);

	// List filter — 'todo' hides ticked rows so what's left to order stands out.
	type Filter = 'all' | 'todo' | 'ordered';
	let filter = $state<Filter>('all');
	const visibleList = $derived(
		filter === 'todo' ? data.restockList.filter((i) => !ordered[i.id])
		: filter === 'ordered' ? data.restockList.filter((i) => ordered[i.id])
		: data.restockList
	);
	const filters = $derived<{ key: Filter; label: string; count: number }[]>([
		{ key: 'all', label: 'All', count: data.restockList.length },
		{ key: 'todo', label: 'Pending', count: data.restockList.length - orderedCount },
		{ key: 'ordered', label: 'Completed', count: orderedCount }
	]);

	// Editable restock qty — saved on blur/Enter straight to the action (no
	// per-row <form>, which was too heavy for 500+ rows). Not $state: the
	// input owns its value; we only need the latest number for CSV export.
	const qty: Record<string, number> = Object.fromEntries(data.restockList.map((i) => [i.id, i.actualRestock ?? 0]));
	async function commitQty(id: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const v = parseInt(input.value, 10);
		const n = Number.isFinite(v) && v >= 0 ? v : 0;
		if (n === qty[id]) return;
		qty[id] = n;
		input.value = String(n);
		const fd = new FormData();
		fd.set('id', id);
		fd.set('qty', String(n));
		await fetch('?/updateQty', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
	}

	// "Show current stock": live Shopify available per variant, fetched once
	// on first toggle. Sessions can be days old, so the snapshot in
	// item.currentStock may be stale by ordering time.
	let showStock = $state(false);
	let liveStock = $state<Record<string, number> | null>(null);
	let stockLoading = $state(false);
	let stockError = $state<string | null>(null);

	async function toggleStock() {
		showStock = !showStock;
		if (!showStock || liveStock || stockLoading) return;
		stockLoading = true;
		stockError = null;
		try {
			const res = await fetch(`/dispatcher/stores/${storeId}/restock/${sessionId}/complete/stock`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			liveStock = await res.json();
		} catch (e) {
			stockError = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			stockLoading = false;
		}
	}

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
		const rows = data.restockList.map((i) => [i.productTitle, i.variantTitle ?? '', i.sku ?? '', qty[i.id] ?? i.actualRestock ?? 0]);
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
		<div class="flex items-center gap-2 shrink-0 flex-wrap">
			<Button variant="outline" onclick={toggleStock} disabled={data.restockList.length === 0} class={showStock ? 'bg-accent' : ''}>
				{#if stockLoading}
					<Loader2Icon class="size-4 animate-spin" />
				{:else if showStock}
					<EyeOffIcon class="size-4" />
				{:else}
					<EyeIcon class="size-4" />
				{/if}
				{showStock ? 'Hide' : 'Show'} current stock
			</Button>
			<Button variant="outline" onclick={exportCSV} disabled={data.restockList.length === 0}>
				<DownloadIcon class="size-4" />
				Export CSV
			</Button>
		</div>
	</div>

	{#if showStock && stockError}
		<div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900 mb-4">Couldn't load current stock: {stockError}</div>
	{/if}

	{#if data.restockList.length === 0}
		<div class="card border-dashed p-12 text-center">
			<p class="text-sm font-medium text-foreground">No items to restock</p>
			<p class="text-xs text-muted-foreground mt-1">No variants had an actual restock quantity greater than 0</p>
		</div>
	{:else}
		<div class="mb-3">
			<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
			{#each filters as f}
				<button
					type="button"
					onclick={() => filter = f.key}
					class="px-2.5 py-1.5 rounded-md font-medium transition-colors tabular-nums {filter === f.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					{f.label} <span class="opacity-70">{f.count}</span>
				</button>
			{/each}
		</div>
		</div>
		<div class="card overflow-hidden divide-y divide-border">
			{#if visibleList.length === 0}
				<div class="p-8 text-center text-sm text-muted-foreground">
					{filter === 'todo' ? 'Nothing pending.' : 'Nothing completed yet.'}
				</div>
			{/if}
			{#each visibleList as item (item.id)}
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
					{#if showStock}
						{@const live = liveStock?.[item.variantId]}
						<div class="shrink-0 text-right text-xs tabular-nums leading-tight">
							<div class="text-muted-foreground">Stock</div>
							{#if stockLoading}
								<Loader2Icon class="size-3 animate-spin inline text-muted-foreground" />
							{:else if live == null}
								<span class="text-muted-foreground">—</span>
							{:else}
								<span class="font-semibold {live <= 0 ? 'text-red-600' : 'text-foreground'}">{live}</span>
							{/if}
						</div>
					{/if}
					<input
						type="number"
						min="0"
						inputmode="numeric"
						value={qty[item.id]}
						onchange={(e) => commitQty(item.id, e)}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } }}
						class="shrink-0 w-14 h-8 text-center text-xs font-bold rounded-lg tabular-nums border-0 {isOrdered ? 'bg-green-600' : 'bg-foreground'} text-background focus:ring-2 focus:ring-ring focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						title="Restock quantity — edit and press Enter"
					/>
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
