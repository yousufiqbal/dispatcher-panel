<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { addToast } from '$lib/toast.svelte';
	import { calcRestock, urgency, type LiveStock } from '$lib/restock-calc';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import LayersIcon from '@lucide/svelte/icons/layers';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);
	const base = $derived(`/dispatcher/stores/${storeId}/restock/${data.session.id}`);

	type Mode = 'air' | 'sea' | null;

	// Live stock arrives after first paint (streamed from the load).
	let stock = $state<Record<string, LiveStock> | null>(null);
	let stockError = $state<string | null>(null);
	let stockLoading = $state(true);
	$effect(() => {
		stockLoading = true;
		data.live.then((r) => {
			stock = r.stock;
			stockError = r.error;
			stockLoading = false;
		});
	});

	// Local copies of the editable fields — rows save individually, so the
	// table stays the source of truth between saves.
	let qty = $state<Record<string, number | null>>(Object.fromEntries(data.items.map((i) => [i.id, i.actualRestock])));
	let modes = $state<Record<string, Mode>>(Object.fromEntries(data.items.map((i) => [i.id, i.restockMode])));
	let saving = $state<Record<string, boolean>>({});
	const anySaving = $derived(Object.values(saving).some(Boolean));

	const rows = $derived(
		data.items.map((i) => {
			const s = stock?.[i.variantId] ?? null;
			const calc = s ? calcRestock({ s30: i.sales30, s60: i.sales60, s90: i.sales90 }, s, data.lead) : null;
			return { ...i, stock: s, calc, level: calc ? urgency(calc, data.lead) : null };
		})
	);

	type Filter = 'all' | 'needs' | 'entered';
	let filter = $state<Filter>('all');
	let sortBy = $state<'urgency' | 'session'>('urgency');
	let query = $state('');

	type Row = (typeof rows)[number];

	// Variants grouped under their product (rows arrive in position /
	// variantPosition order, so grouping keeps variant order). Filters apply
	// per variant; a product with no matching variants drops out. Urgency sort
	// orders products by their most urgent variant.
	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const byProduct = new Map<number, { position: number; title: string; imageUrl: string | null; rows: Row[]; cover: number }>();
		for (const r of rows) {
			if (filter === 'needs' && !(r.calc && (r.calc.recAir > 0 || r.calc.recSea > 0))) continue;
			if (filter === 'entered' && !qty[r.id]) continue;
			if (q && ![r.productTitle, r.variantTitle ?? '', r.sku ?? ''].some((t) => t.toLowerCase().includes(q))) continue;
			let g = byProduct.get(r.position);
			if (!g) byProduct.set(r.position, (g = { position: r.position, title: r.productTitle, imageUrl: r.productImageUrl, rows: [], cover: Infinity }));
			g.rows.push(r);
			g.cover = Math.min(g.cover, r.calc?.coverDays ?? Infinity);
		}
		const list = [...byProduct.values()];
		if (sortBy === 'urgency' && stock) list.sort((a, b) => a.cover - b.cover || a.position - b.position);
		return list;
	});

	const counts = $derived({
		all: rows.length,
		needs: rows.filter((r) => r.calc && (r.calc.recAir > 0 || r.calc.recSea > 0)).length,
		entered: rows.filter((r) => qty[r.id]).length
	});

	// A product counts as done once any of its variants has a qty — same rule
	// the one-by-one view uses for its progress.
	const progress = $derived.by(() => {
		const done = new Set<number>();
		const all = new Set<number>();
		for (const r of rows) {
			all.add(r.position);
			if (qty[r.id] != null) done.add(r.position);
		}
		let resume = 0;
		for (const p of [...all].sort((a, b) => a - b)) {
			if (!done.has(p)) {
				resume = p;
				break;
			}
		}
		return { done: done.size, total: all.size, resume };
	});

	const totals = $derived.by(() => {
		let air = 0, sea = 0, other = 0;
		for (const r of rows) {
			const n = qty[r.id] ?? 0;
			if (modes[r.id] === 'air') air += n;
			else if (modes[r.id] === 'sea') sea += n;
			else other += n;
		}
		return { air, sea, other };
	});

	async function saveRow(id: string, nextQty: number | null, nextMode: Mode) {
		qty[id] = nextQty;
		modes[id] = nextQty ? nextMode : null;
		saving[id] = true;
		const fd = new FormData();
		fd.set('id', id);
		fd.set('qty', nextQty == null ? '' : String(nextQty));
		fd.set('mode', modes[id] ?? '');
		try {
			const res = await fetch('?/saveRow', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
			const result = res.ok ? await res.json() : null;
			if (result?.type !== 'success') throw new Error();
		} catch {
			const row = rows.find((r) => r.id === id);
			addToast(`Couldn't save ${row?.productTitle ?? 'row'} — try again`, 'error');
		} finally {
			saving[id] = false;
		}
	}

	function onQtyChange(id: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const v = parseInt(input.value, 10);
		const next = input.value === '' ? null : Number.isFinite(v) && v >= 0 ? v : 0;
		input.value = next == null ? '' : String(next);
		if (next === qty[id]) return;
		saveRow(id, next, modes[id]);
	}

	// Enter moves down the column, like a spreadsheet.
	function onQtyKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const inputs = [...document.querySelectorAll<HTMLInputElement>('input[data-qty]')];
		const i = inputs.indexOf(e.currentTarget as HTMLInputElement);
		(e.currentTarget as HTMLInputElement).blur();
		inputs[i + 1]?.focus();
		inputs[i + 1]?.select();
	}

	function coverLabel(days: number | null | undefined): string {
		if (days == null) return '—';
		return days >= 365 ? '1y+' : `${Math.floor(days)}d`;
	}

	const levelClass: Record<string, string> = {
		critical: 'bg-red-50 text-red-700',
		soon: 'bg-amber-50 text-amber-800',
		ok: 'text-foreground',
		idle: 'text-muted-foreground'
	};

	function thumbUrl(url: string | null | undefined): string {
		if (!url) return '';
		if (url.includes('cdn.shopify.com')) {
			const u = new URL(url);
			u.searchParams.set('width', '72');
			return u.toString();
		}
		return url;
	}

	let finishing = $state(false);
</script>

{#snippet variantRow(r: Row, nested: boolean)}
	<tr class="hover:bg-yellow-50/60 focus-within:bg-yellow-50">
		<td class="px-3 py-2">
			{#if nested}
				<!-- Under a product header: indent, and only show the variant's own
				     image when it differs from the product's. -->
				<div class="flex items-center gap-2 min-w-0 pl-5 border-l-2 border-border ml-4">
					{#if r.variantImageUrl && r.variantImageUrl !== r.productImageUrl}
						<img src={thumbUrl(r.variantImageUrl)} alt="" loading="lazy" class="size-7 object-cover rounded border border-border bg-muted shrink-0" />
					{/if}
					<div class="min-w-0">
						<div class="font-medium text-foreground truncate">{r.variantTitle}</div>
						{#if r.sku}<div class="text-xs text-muted-foreground font-mono truncate">{r.sku}</div>{/if}
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-2.5 min-w-0">
					{#if r.variantImageUrl ?? r.productImageUrl}
						<img src={thumbUrl(r.variantImageUrl ?? r.productImageUrl)} alt="" loading="lazy" class="size-9 object-cover rounded-md border border-border bg-muted shrink-0" />
					{:else}
						<div class="size-9 rounded-md bg-muted shrink-0"></div>
					{/if}
					<div class="min-w-0">
						<div class="font-semibold text-foreground truncate">{r.productTitle}</div>
						{#if r.sku}<div class="text-xs text-muted-foreground font-mono truncate">{r.sku}</div>{/if}
					</div>
				</div>
			{/if}
		</td>
		<td class="px-2 py-2 text-center tabular-nums">{r.sales30}</td>
		<td class="px-2 py-2 text-center tabular-nums text-muted-foreground">{r.sales90}</td>
		{#if stockLoading}
			<td colspan="5" class="px-2 py-2 text-center"><Loader2Icon class="size-3.5 animate-spin inline text-muted-foreground" /></td>
		{:else}
			<td class="px-2 py-2 text-center tabular-nums font-semibold {r.stock && r.stock.available <= 0 ? 'text-red-600' : ''}" title={r.stock ? `${r.stock.committed} committed` : undefined}>
				{r.stock?.available ?? '—'}
			</td>
			<td class="px-2 py-2 text-center tabular-nums {r.stock?.incoming ? 'text-violet-700 font-semibold' : 'text-muted-foreground'}">{r.stock?.incoming ?? '—'}</td>
			<td class="px-1 py-2 text-center">
				<span class="inline-block rounded-md px-1.5 py-0.5 tabular-nums text-xs font-semibold {levelClass[r.level ?? 'idle']}">{coverLabel(r.calc?.coverDays)}</span>
			</td>
			<td class="px-1 py-2 text-center">
				{#if r.calc}
					<button
						type="button"
						tabindex="-1"
						onclick={() => saveRow(r.id, r.calc!.recAir, 'air')}
						title="Use {r.calc.recAir} for an air shipment"
						class="w-11 rounded-md py-1 tabular-nums font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 {modes[r.id] === 'air' ? 'ring-2 ring-blue-400' : ''}"
					>{r.calc.recAir}</button>
				{/if}
			</td>
			<td class="px-1 py-2 text-center">
				{#if r.calc}
					<button
						type="button"
						tabindex="-1"
						onclick={() => saveRow(r.id, r.calc!.recSea, 'sea')}
						title="Use {r.calc.recSea} for a sea shipment"
						class="w-11 rounded-md py-1 tabular-nums font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 {modes[r.id] === 'sea' ? 'ring-2 ring-teal-400' : ''}"
					>{r.calc.recSea}</button>
				{/if}
			</td>
		{/if}
		<td class="px-3 py-2">
			<div class="w-16">
				<input
					data-qty
					type="number"
					min="0"
					inputmode="numeric"
					placeholder="—"
					value={qty[r.id] ?? ''}
					onchange={(e) => onQtyChange(r.id, e)}
					onkeydown={onQtyKeydown}
					class="w-16 h-8 text-center font-semibold rounded-md border border-border bg-card tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
			</div>
		</td>
	</tr>
{/snippet}

<svelte:head><title>Restock table — {data.items.length} variants</title></svelte:head>

<div class="p-3 sm:p-6 max-w-6xl mx-auto">
	<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
		<div>
			<a href="/dispatcher/stores/{storeId}/restock" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2 w-fit">
				<ArrowLeftIcon class="size-4" />
				Sessions
			</a>
			<h1 class="text-xl font-bold text-foreground">Restock — table</h1>
			<p class="text-sm text-muted-foreground mt-1 tabular-nums">
				<span class="text-foreground font-medium">{progress.done}</span>/{progress.total} products done
				· <span class="text-blue-700">✈ {totals.air}</span>
				· <span class="text-teal-700">🚢 {totals.sea}</span>
				{#if totals.other}· {totals.other} unassigned{/if}
			</p>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<Button variant="outline" href="{base}/{progress.resume}">
				<LayersIcon class="size-4" />
				One by one
			</Button>
			<form method="POST" action="?/complete" use:enhance={() => {
				finishing = true;
				return async ({ update }) => { await update(); finishing = false; };
			}}>
				<Button type="submit" disabled={anySaving || finishing} class="bg-green-600 hover:bg-green-700">
					{#if finishing}<Loader2Icon class="size-4 animate-spin" />{:else}<CheckIcon class="size-4" />{/if}
					{data.session.completedAt ? 'Restock list' : 'Finish'}
				</Button>
			</form>
		</div>
	</div>

	{#if stockError}
		<div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900 mb-4">
			Couldn't load live stock from Shopify, so recommendations are hidden: {stockError}
		</div>
	{/if}

	<div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
		<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs w-fit">
			{#each [{ key: 'all', label: 'All' }, { key: 'needs', label: 'Needs restock' }, { key: 'entered', label: 'Entered' }] as f (f.key)}
				<button
					type="button"
					onclick={() => (filter = f.key as Filter)}
					class="px-2.5 py-1.5 rounded-md font-medium transition-colors tabular-nums {filter === f.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					{f.label}
					<span class="opacity-70">{f.key === 'needs' && stockLoading ? '…' : counts[f.key as Filter]}</span>
				</button>
			{/each}
		</div>
		<select bind:value={sortBy} class="h-8 rounded-lg border border-border bg-card px-2 text-xs w-fit">
			<option value="urgency">Most urgent first</option>
			<option value="session">Session order</option>
		</select>
		<Input bind:value={query} type="search" placeholder="Search product, variant, SKU…" class="h-8 text-sm sm:max-w-64 sm:ml-auto" />
	</div>

	<div class="card overflow-x-auto">
		<table class="w-full table-fixed text-sm min-w-[760px]">
			<thead class="bg-muted/30 border-b border-border">
				<tr class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
					<th class="text-left px-3 py-2.5">Item</th>
					<th class="px-2 py-2.5 w-14" title="Sold in the last 30 days">30d</th>
					<th class="px-2 py-2.5 w-14" title="Sold in the last 90 days">90d</th>
					<th class="px-2 py-2.5 w-16" title="Live available in Shopify">Avail</th>
					<th class="px-2 py-2.5 w-20" title="On open Shopify purchase orders / transfers">Incoming</th>
					<th class="px-2 py-2.5 w-14" title="Days until available + incoming runs out">Lasts</th>
					<th class="px-2 py-2.5 w-14 text-blue-500">✈ Air</th>
					<th class="px-2 py-2.5 w-14 text-teal-600">🚢 Sea</th>
					<th class="px-3 py-2.5 w-24">Qty</th>
				</tr>
			</thead>
			{#each groups as g (g.position)}
				<!-- One tbody per product, so each product reads as a block. -->
				<tbody class="border-t-4 border-muted first-of-type:border-t-0">
					{#if g.rows[0].variantTitle !== null}
						{@const sold90 = g.rows.reduce((s, r) => s + r.sales90, 0)}
						<tr class="bg-muted/40">
							<td colspan="9" class="px-3 py-2">
								<div class="flex items-center gap-2.5 min-w-0">
									{#if g.imageUrl}
										<img src={thumbUrl(g.imageUrl)} alt="" loading="lazy" class="size-9 object-cover rounded-md border border-border bg-muted shrink-0" />
									{:else}
										<div class="size-9 rounded-md bg-muted shrink-0"></div>
									{/if}
									<div class="min-w-0">
										<div class="font-semibold text-foreground truncate">{g.title}</div>
										<div class="text-xs text-muted-foreground tabular-nums">{g.rows.length} variant{g.rows.length > 1 ? 's' : ''} · {sold90} sold in 90d</div>
									</div>
								</div>
							</td>
						</tr>
						{#each g.rows as r (r.id)}
							{@render variantRow(r, true)}
						{/each}
					{:else}
						{@render variantRow(g.rows[0], false)}
					{/if}
				</tbody>
			{:else}
				<tbody><tr><td colspan="9" class="p-8 text-center text-sm text-muted-foreground">No matching items.</td></tr></tbody>
			{/each}
		</table>
	</div>
</div>
