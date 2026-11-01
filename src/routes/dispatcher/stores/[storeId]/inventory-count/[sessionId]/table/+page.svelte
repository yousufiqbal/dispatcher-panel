<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { addToast } from '$lib/toast.svelte';
	import { isBigDifference } from '$lib/inventory-audit';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import Lightbox from '$lib/components/Lightbox.svelte';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);
	const base = $derived(`/dispatcher/stores/${storeId}/inventory-count/${data.session.id}`);

	// Live on_hand arrives after first paint (streamed from the load).
	let liveOnHand = $state<Record<string, number> | null>(null);
	let stockError = $state<string | null>(null);
	let stockLoading = $state(true);
	$effect(() => {
		stockLoading = true;
		data.live.then((r) => {
			liveOnHand = r.onHand;
			stockError = r.error;
			stockLoading = false;
		});
	});

	// Local copies of the editable fields — rows save individually. `baseline`
	// is the on_hand a counted row was diffed against (set by the server).
	let counts = $state<Record<string, number | null>>(Object.fromEntries(data.items.map((i) => [i.id, i.newStock])));
	let baselines = $state<Record<string, number>>(Object.fromEntries(data.items.map((i) => [i.id, i.currentStock])));
	let skipped = $state<Record<string, boolean>>(Object.fromEntries(data.items.map((i) => [i.id, i.skipped])));
	let saving = $state<Record<string, boolean>>({});
	const anySaving = $derived(Object.values(saving).some(Boolean));

	const rows = $derived(
		data.items.map((i) => {
			const count = counts[i.id];
			// Counted: the on_hand it was diffed against. Not yet: live on_hand.
			const system = count != null ? baselines[i.id] : liveOnHand?.[i.variantId] ?? null;
			const diff = count != null && system !== null ? count - system : null;
			return { ...i, count, system, diff, big: diff !== null && system !== null && isBigDifference(system, count!) };
		})
	);
	type Row = (typeof rows)[number];

	type Filter = 'all' | 'todo' | 'diff' | 'skipped';
	let filter = $state<Filter>('all');
	let query = $state('');

	const counts_ = $derived({
		all: rows.length,
		todo: rows.filter((r) => r.count == null).length,
		diff: rows.filter((r) => r.diff).length,
		skipped: rows.filter((r) => r.count == null && skipped[r.id]).length
	});

	// Variants grouped under their product; filters apply per variant.
	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const byProduct = new Map<number, { position: number; title: string; imageUrl: string | null; rows: Row[] }>();
		for (const r of rows) {
			if (filter === 'todo' && r.count != null) continue;
			if (filter === 'diff' && !r.diff) continue;
			if (filter === 'skipped' && !(r.count == null && skipped[r.id])) continue;
			if (q && ![r.productTitle, r.variantTitle ?? '', r.sku ?? ''].some((t) => t.toLowerCase().includes(q))) continue;
			let g = byProduct.get(r.position);
			if (!g) byProduct.set(r.position, (g = { position: r.position, title: r.productTitle, imageUrl: r.productImageUrl, rows: [] }));
			g.rows.push(r);
		}
		return [...byProduct.values()];
	});

	// Same "done" rule as the one-by-one view: any variant counted.
	const progress = $derived.by(() => {
		const done = new Set<number>();
		const all = new Set<number>();
		for (const r of rows) {
			all.add(r.position);
			if (r.count != null) done.add(r.position);
		}
		const resume = [...all].sort((a, b) => a - b).find((p) => !done.has(p)) ?? 0;
		return { done: done.size, total: all.size, resume };
	});

	async function saveRow(id: string, value: number | 'match' | null) {
		saving[id] = true;
		const fd = new FormData();
		fd.set('id', id);
		fd.set('value', value === null ? '' : String(value));
		try {
			const res = await fetch('?/saveRow', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
			const result = deserialize(await res.text());
			if (result.type !== 'success' || !result.data) throw new Error();
			const row = result.data as { newStock: number | null; currentStock: number };
			counts[id] = row.newStock;
			baselines[id] = row.currentStock;
			if (row.newStock != null) skipped[id] = false;
		} catch {
			const item = data.items.find((i) => i.id === id);
			addToast(`Couldn't save ${item?.productTitle ?? 'row'} — try again`, 'error');
		} finally {
			saving[id] = false;
		}
	}

	function onCountChange(id: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const v = parseInt(input.value, 10);
		const next = input.value === '' ? null : Number.isFinite(v) && v >= 0 ? v : 0;
		input.value = next == null ? '' : String(next);
		if (next === counts[id]) return;
		counts[id] = next;
		saveRow(id, next);
	}

	// Enter moves down the column, like a spreadsheet.
	function onCountKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const inputs = [...document.querySelectorAll<HTMLInputElement>('input[data-count]')];
		const i = inputs.indexOf(e.currentTarget as HTMLInputElement);
		(e.currentTarget as HTMLInputElement).blur();
		inputs[i + 1]?.focus();
		inputs[i + 1]?.select();
	}

	function thumbUrl(url: string | null | undefined): string {
		if (!url) return '';
		if (url.includes('cdn.shopify.com')) {
			const u = new URL(url);
			u.searchParams.set('width', '72');
			return u.toString();
		}
		return url;
	}

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');
	function openImage(url: string | null | undefined, alt: string) {
		if (!url) return;
		lightboxUrl = url;
		lightboxAlt = alt;
	}

	let finishing = $state(false);
	const filters: { key: Filter; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'todo', label: 'Not counted' },
		{ key: 'diff', label: 'Different' },
		{ key: 'skipped', label: 'Skipped' }
	];
</script>

{#snippet countRow(r: Row, nested: boolean)}
	<tr class="hover:bg-yellow-50/60 focus-within:bg-yellow-50">
		<td class="px-3 py-2">
			{#if nested}
				<div class="flex items-center gap-2 min-w-0 pl-5 border-l-2 border-border ml-4">
					{#if r.variantImageUrl && r.variantImageUrl !== r.productImageUrl}
						<button type="button" tabindex="-1" class="shrink-0 cursor-zoom-in" onclick={() => openImage(r.variantImageUrl, `${r.productTitle} — ${r.variantTitle}`)}>
							<img src={thumbUrl(r.variantImageUrl)} alt="" loading="lazy" class="size-7 object-cover rounded border border-border bg-muted" />
						</button>
					{/if}
					<div class="min-w-0">
						<div class="font-medium text-foreground truncate">{r.variantTitle}</div>
						{#if r.sku}<div class="text-xs text-muted-foreground font-mono truncate">{r.sku}</div>{/if}
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-2.5 min-w-0">
					{#if r.variantImageUrl ?? r.productImageUrl}
						<button type="button" tabindex="-1" class="shrink-0 cursor-zoom-in" onclick={() => openImage(r.variantImageUrl ?? r.productImageUrl, r.productTitle)}>
							<img src={thumbUrl(r.variantImageUrl ?? r.productImageUrl)} alt="" loading="lazy" class="size-9 object-cover rounded-md border border-border bg-muted" />
						</button>
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
		<td class="px-2 py-2 text-center tabular-nums font-semibold {r.system !== null && r.system <= 0 ? 'text-red-600' : ''}" title={r.count != null ? 'On hand when counted' : 'On hand now'}>
			{#if r.system === null && stockLoading}
				<Loader2Icon class="size-3.5 animate-spin inline text-muted-foreground" />
			{:else}
				{r.system ?? '—'}
			{/if}
		</td>
		<td class="px-2 py-2">
			<div class="flex items-center gap-1.5 justify-center">
				<input
					data-count
					type="number"
					min="0"
					inputmode="numeric"
					placeholder={r.system === null ? '—' : String(r.system)}
					value={r.count ?? ''}
					onchange={(e) => onCountChange(r.id, e)}
					onkeydown={onCountKeydown}
					class="w-16 h-8 text-center font-semibold rounded-md border border-border bg-card tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<button
					type="button"
					tabindex="-1"
					disabled={saving[r.id] || r.system === null}
					onclick={() => saveRow(r.id, 'match')}
					title="Shelf matches Shopify"
					class="size-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-green-700 hover:bg-green-50 disabled:opacity-40"
				>
					<CheckIcon class="size-4" />
				</button>
			</div>
		</td>
		<td class="px-2 py-2 text-center">
			{#if r.diff}
				<span
					title={r.big ? 'Big difference — worth a recount' : undefined}
					class="inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums {r.diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} {r.big ? 'ring-2 ring-amber-400' : ''}"
				>{r.diff > 0 ? '+' : ''}{r.diff}</span>
			{:else if r.count != null}
				<span class="text-xs text-muted-foreground">match</span>
			{:else if skipped[r.id]}
				<EyeOffIcon class="size-3.5 inline text-amber-600" />
			{/if}
		</td>
	</tr>
{/snippet}

<svelte:head><title>Audit table — {data.items.length} variants</title></svelte:head>

<div class="p-3 sm:p-6 max-w-5xl mx-auto">
	<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
		<div>
			<a href="/dispatcher/stores/{storeId}/inventory-count" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2 w-fit">
				<ArrowLeftIcon class="size-4" />
				Sessions
			</a>
			<h1 class="text-xl font-bold text-foreground">Inventory audit — table</h1>
			<p class="text-sm text-muted-foreground mt-1 tabular-nums">
				<span class="text-foreground font-medium">{progress.done}</span>/{progress.total} products counted
				{#if data.session.scopeLabel}· {data.session.scopeLabel}{/if}
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
					{data.session.completedAt ? 'Report' : 'Finish'}
				</Button>
			</form>
		</div>
	</div>

	{#if stockError}
		<div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900 mb-4">
			Couldn't load live stock from Shopify: {stockError}. Counts still save — Shopify stock is read again on each save.
		</div>
	{/if}

	<div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
		<div class="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs w-fit">
			{#each filters as f (f.key)}
				<button
					type="button"
					onclick={() => (filter = f.key)}
					class="px-2.5 py-1.5 rounded-md font-medium transition-colors tabular-nums {filter === f.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					{f.label} <span class="opacity-70">{counts_[f.key]}</span>
				</button>
			{/each}
		</div>
		<Input bind:value={query} type="search" placeholder="Search product, variant, SKU…" class="h-8 text-sm sm:max-w-64 sm:ml-auto" />
	</div>

	<div class="card overflow-x-auto">
		<table class="w-full table-fixed text-sm min-w-[560px]">
			<thead class="bg-muted/30 border-b border-border">
				<tr class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
					<th class="text-left px-3 py-2.5">Item</th>
					<th class="px-2 py-2.5 w-20" title="Shopify on hand — live until counted, then the number the count was compared against">Shopify</th>
					<th class="px-2 py-2.5 w-36">Count</th>
					<th class="px-2 py-2.5 w-20">Diff</th>
				</tr>
			</thead>
			{#each groups as g (g.position)}
				<tbody class="border-t-4 border-muted first-of-type:border-t-0">
					{#if g.rows[0].variantTitle !== null}
						<tr class="bg-muted/40">
							<td colspan="4" class="px-3 py-2">
								<div class="flex items-center gap-2.5 min-w-0">
									{#if g.imageUrl}
										<button type="button" tabindex="-1" class="shrink-0 cursor-zoom-in" onclick={() => openImage(g.imageUrl, g.title)}>
											<img src={thumbUrl(g.imageUrl)} alt="" loading="lazy" class="size-9 object-cover rounded-md border border-border bg-muted" />
										</button>
									{:else}
										<div class="size-9 rounded-md bg-muted shrink-0"></div>
									{/if}
									<div class="min-w-0">
										<div class="font-semibold text-foreground truncate">{g.title}</div>
										<div class="text-xs text-muted-foreground tabular-nums">{g.rows.length} variant{g.rows.length > 1 ? 's' : ''}</div>
									</div>
								</div>
							</td>
						</tr>
						{#each g.rows as r (r.id)}
							{@render countRow(r, true)}
						{/each}
					{:else}
						{@render countRow(g.rows[0], false)}
					{/if}
				</tbody>
			{:else}
				<tbody><tr><td colspan="4" class="p-8 text-center text-sm text-muted-foreground">No matching items.</td></tr></tbody>
			{/each}
		</table>
	</div>
</div>

<Lightbox bind:url={lightboxUrl} alt={lightboxAlt} />
