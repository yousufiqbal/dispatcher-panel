<script lang="ts">
	import { page } from '$app/stores';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import Lightbox, { type LightboxItem } from '$lib/components/Lightbox.svelte';
	import { addToast } from '$lib/toast.svelte';
	import {
		parseGrams,
		formatGrams,
		median,
		isOutlier,
		HEAVY_WARN_GRAMS,
		MAX_APPLY_PRODUCTS,
		type WeightApplyRequest,
		type WeightApplyResponse
	} from '$lib/weights';
	import ImageIcon from '@lucide/svelte/icons/image';
	import SearchIcon from '@lucide/svelte/icons/search';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import XIcon from '@lucide/svelte/icons/x';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const storeId = $derived($page.params.storeId);

	type Product = PageData['products'][number];
	type Variant = Product['variants'][number];

	// --- Weight state --------------------------------------------------------
	// `saved` holds weights pushed this session (so the page reflects them
	// without refetching the whole catalog); `edits` holds staged, unsaved
	// values; `drafts` is the raw text while a cell is being typed in.
	const saved = new SvelteMap<string, number>();
	const edits = new SvelteMap<string, number>();
	const drafts = new SvelteMap<string, string>();
	const rowErrors = new SvelteMap<string, string>();

	function live(v: Variant): number {
		return saved.get(v.id) ?? v.weightGrams;
	}
	function current(v: Variant): number {
		return edits.get(v.id) ?? live(v);
	}
	function stage(v: Variant, grams: number) {
		rowErrors.delete(v.id);
		if (grams === live(v)) edits.delete(v.id);
		else edits.set(v.id, grams);
	}

	// Single-variant products carry Shopify's placeholder title — show the
	// weight inline on the product row instead of a lone "Default Title" row.
	function isSingle(p: Product) {
		return p.variants.length === 1 && p.variants[0].title === 'Default Title';
	}
	function variantLabel(v: Variant) {
		return v.selectedOptions.map((o) => o.value).join(' / ') || v.title;
	}

	// --- Images + lightbox ---------------------------------------------------
	// A variant without its own photo shows the product's featured image.
	function imageOf(p: Product, v?: Variant): { thumb: string; full: string } | null {
		if (v?.imageUrl) return { thumb: v.thumbUrl ?? v.imageUrl, full: v.imageUrl };
		return p.imageUrl ? { thumb: p.imageUrl, full: p.imageUrl } : null;
	}

	let lightboxUrl = $state<string | null>(null);
	let lightboxItems = $state<LightboxItem[]>([]);
	let lightboxIndex = $state(0);
	// The review dialog traps focus and shares the lightbox's z-layer, so a
	// thumbnail clicked there closes the dialog and reopens it afterwards.
	let reopenReview = false;

	// Pages through every variant of the product (← →), starting on the one clicked.
	function openGallery(p: Product, v?: Variant, fromReview = false) {
		const variants = isSingle(p) ? [] : p.variants;
		const items: LightboxItem[] = variants.length
			? variants.flatMap((x) => {
					const img = imageOf(p, x);
					return img ? [{ url: img.full, alt: variantLabel(x), title: p.title, subtitle: variantLabel(x) }] : [];
				})
			: [imageOf(p, p.variants[0])].flatMap((img) => (img ? [{ url: img.full, alt: p.title, title: p.title }] : []));
		if (items.length === 0) return;
		const start = v ? variants.filter((x) => imageOf(p, x)).findIndex((x) => x.id === v.id) : 0;
		lightboxItems = items;
		lightboxIndex = Math.max(0, start);
		lightboxUrl = items[lightboxIndex].url;
		if (fromReview) {
			reopenReview = true;
			reviewOpen = false;
		}
	}

	$effect(() => {
		if (lightboxUrl === null && reopenReview) {
			reopenReview = false;
			reviewOpen = true;
		}
	});

	// --- Stats ---------------------------------------------------------------
	const variantMeta = $derived.by(() => {
		const meta: Record<string, { outlier: boolean } | undefined> = {};
		for (const p of data.products) {
			const grams = p.variants.map(live);
			p.variants.forEach((v, i) => (meta[v.id] = { outlier: isOutlier(grams[i], grams) }));
		}
		return meta;
	});

	function productState(p: Product): 'complete' | 'partial' | 'none' {
		const weighted = p.variants.filter((v) => live(v) > 0).length;
		if (weighted === 0) return 'none';
		return weighted === p.variants.length ? 'complete' : 'partial';
	}

	const BUCKETS = [
		{ label: '<250g', max: 250 },
		{ label: '250–500g', max: 500 },
		{ label: '0.5–1kg', max: 1000 },
		{ label: '1–2kg', max: 2000 },
		{ label: '2kg+', max: Infinity }
	];

	const stats = $derived.by(() => {
		const all = data.products.flatMap((p) => p.variants);
		const weights = all.map(live).filter((g) => g > 0);
		const missing = all.filter((v) => live(v) === 0);
		const states = data.products.map(productState);
		const buckets = BUCKETS.map((b) => ({ ...b, count: 0 }));
		for (const g of weights) buckets.find((b) => g < b.max)!.count++;
		let heaviest: { title: string; grams: number } | null = null;
		for (const p of data.products)
			for (const v of p.variants)
				if (!heaviest || live(v) > heaviest.grams)
					heaviest = { title: isSingle(p) ? p.title : `${p.title} · ${variantLabel(v)}`, grams: live(v) };
		return {
			total: all.length,
			weighted: weights.length,
			missing: missing.length,
			missingInStock: missing.filter((v) => v.inventoryQuantity > 0).length,
			coverage: all.length ? Math.round((weights.length / all.length) * 100) : 0,
			complete: states.filter((s) => s === 'complete').length,
			partial: states.filter((s) => s === 'partial').length,
			none: states.filter((s) => s === 'none').length,
			outliers: all.filter((v) => variantMeta[v.id]?.outlier).length,
			nonGram: all.filter((v) => v.weightUnit && v.weightUnit !== 'GRAMS' && !saved.has(v.id)).length,
			median: Math.round(median(weights)),
			average: weights.length ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0,
			heaviest: heaviest && heaviest.grams > 0 ? heaviest : null,
			buckets,
			bucketMax: Math.max(1, ...buckets.map((b) => b.count))
		};
	});

	// --- Filters -------------------------------------------------------------
	type FilterKey = 'all' | 'missing' | 'instock' | 'partial' | 'outliers' | 'edited';
	let filter = $state<FilterKey>('all');
	let search = $state('');
	let collectionId = $state('all');

	const filterChips = $derived<{ key: FilterKey; label: string; count: number }[]>([
		{ key: 'all', label: 'All', count: stats.total },
		{ key: 'missing', label: 'Missing', count: stats.missing },
		{ key: 'instock', label: 'Missing · in stock', count: stats.missingInStock },
		{ key: 'partial', label: 'Partial products', count: stats.partial },
		{ key: 'outliers', label: 'Outliers', count: stats.outliers },
		{ key: 'edited', label: 'Unsaved', count: edits.size }
	]);

	function variantMatches(p: Product, v: Variant): boolean {
		switch (filter) {
			case 'missing':
				return live(v) === 0;
			case 'instock':
				return live(v) === 0 && v.inventoryQuantity > 0;
			case 'partial':
				return productState(p) === 'partial';
			case 'outliers':
				return !!variantMeta[v.id]?.outlier;
			case 'edited':
				return edits.has(v.id);
			default:
				return true;
		}
	}

	// Each visible product keeps only its matching variants, so "Missing"
	// shows exactly the cells that need filling.
	const visible = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const out: { product: Product; variants: Variant[] }[] = [];
		for (const p of data.products) {
			if (collectionId !== 'all' && !p.collectionIds.includes(collectionId)) continue;
			const titleHit = !q || p.title.toLowerCase().includes(q);
			const variants = p.variants.filter(
				(v) =>
					variantMatches(p, v) &&
					(titleHit || variantLabel(v).toLowerCase().includes(q) || (v.sku ?? '').toLowerCase().includes(q))
			);
			if (variants.length) out.push({ product: p, variants });
		}
		return out;
	});
	const visibleVariants = $derived(visible.flatMap((g) => g.variants));
	// Flat index → keyboard navigation between cells in on-screen order.
	const cellIndex = $derived(new Map(visibleVariants.map((v, i) => [v.id, i])));

	// --- Inline editing ------------------------------------------------------
	function cellValue(v: Variant): string {
		const d = drafts.get(v.id);
		if (d !== undefined) return d;
		const g = current(v);
		return g > 0 ? String(g) : '';
	}

	function onCellInput(v: Variant, raw: string) {
		drafts.set(v.id, raw);
		if (raw.trim() === '') return; // empty = still typing; blur restores
		const g = parseGrams(raw);
		if (g !== null) stage(v, g);
	}

	function onCellBlur(v: Variant) {
		const d = drafts.get(v.id);
		drafts.delete(v.id);
		// An explicit "0" clears the weight; blank just means "leave it".
		if (d !== undefined && d.trim() !== '' && parseGrams(d) === null) addToast('Enter a weight like 450 or 1.2kg (max 50kg)', 'error');
	}

	function focusCell(i: number) {
		const el = document.querySelector<HTMLInputElement>(`input[data-cell="${i}"]`);
		if (el) {
			el.focus();
			el.select();
		}
	}

	function onCellKey(e: KeyboardEvent, v: Variant) {
		const i = cellIndex.get(v.id) ?? 0;
		if (e.key === 'Enter' || e.key === 'ArrowDown') {
			e.preventDefault();
			focusCell(e.key === 'Enter' && e.shiftKey ? i - 1 : i + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusCell(i - 1);
		} else if (e.key === 'Escape') {
			drafts.delete(v.id);
			edits.delete(v.id);
			(e.currentTarget as HTMLInputElement).blur();
		}
	}

	function isInvalid(v: Variant) {
		const d = drafts.get(v.id);
		return d !== undefined && d.trim() !== '' && parseGrams(d) === null;
	}

	// --- Selection + bulk ----------------------------------------------------
	const selected = new SvelteSet<string>();
	const variantById = $derived(new Map(data.products.flatMap((p) => p.variants.map((v) => [v.id, v] as const))));

	const allVisibleSelected = $derived(visibleVariants.length > 0 && visibleVariants.every((v) => selected.has(v.id)));

	function toggleAllVisible(on: boolean) {
		for (const v of visibleVariants) {
			if (on) selected.add(v.id);
			else selected.delete(v.id);
		}
	}
	function toggleProduct(variants: Variant[], on: boolean) {
		for (const v of variants) {
			if (on) selected.add(v.id);
			else selected.delete(v.id);
		}
	}

	let bulkValue = $state('');
	const bulkGrams = $derived(parseGrams(bulkValue));

	function setSelected() {
		if (bulkGrams === null) return;
		const targets = [...selected].map((id) => variantById.get(id)).filter((v): v is Variant => !!v);
		for (const v of targets) stage(v, bulkGrams);
		addToast(`Set ${targets.length} variant${targets.length === 1 ? '' : 's'} to ${formatGrams(bulkGrams)} — review and save when ready`, 'info');
		bulkValue = '';
		selected.clear();
	}

	// --- Review + save -------------------------------------------------------
	type PendingRow = { product: Product; variant: Variant; from: number; to: number; warning: string | null };

	function warningFor(from: number, to: number): string | null {
		if (to === 0) return 'Clears the weight';
		if (to >= HEAVY_WARN_GRAMS) return 'Over 10 kg';
		if (from > 0 && (to >= from * 3 || to <= from / 3)) return `${to > from ? '+' : '−'}${Math.round(Math.abs(to - from) / from * 100)}% change`;
		return null;
	}

	const pending = $derived.by(() => {
		const rows: PendingRow[] = [];
		for (const p of data.products)
			for (const v of p.variants) {
				const to = edits.get(v.id);
				if (to !== undefined) rows.push({ product: p, variant: v, from: live(v), to, warning: warningFor(live(v), to) });
			}
		return rows;
	});
	const warningCount = $derived(pending.filter((r) => r.warning).length);

	// Compact caps the list width on desktop so the weight input sits next to
	// the variant name instead of at the far edge of a wide screen.
	// Remembered per browser; storage can be unavailable, so never rely on it.
	const COMPACT_KEY = 'weights.compact';
	let compact = $state(true);
	// Read after mount — the server render always starts compact.
	$effect(() => {
		try {
			compact = localStorage.getItem(COMPACT_KEY) !== '0';
		} catch {
			/* default stays */
		}
	});
	function toggleCompact() {
		compact = !compact;
		try {
			localStorage.setItem(COMPACT_KEY, compact ? '1' : '0');
		} catch {
			/* not persisted */
		}
	}

	let reviewOpen = $state(false);
	let saving = $state(false);
	let progress = $state({ done: 0, total: 0 });

	function discardAll() {
		edits.clear();
		drafts.clear();
		rowErrors.clear();
	}

	async function saveAll() {
		const byProduct: Record<string, WeightApplyRequest['products'][number]> = {};
		for (const r of pending) {
			byProduct[r.product.id] ??= { productId: r.product.id, changes: [] };
			byProduct[r.product.id].changes.push({ variantId: r.variant.id, expectedGrams: r.from, grams: r.to });
		}
		const groups = Object.values(byProduct);
		saving = true;
		progress = { done: 0, total: pending.length };
		let applied = 0, conflicts = 0, failed = 0;

		for (let i = 0; i < groups.length; i += MAX_APPLY_PRODUCTS) {
			const batch = groups.slice(i, i + MAX_APPLY_PRODUCTS);
			const batchSize = batch.reduce((n, g) => n + g.changes.length, 0);
			try {
				const res = await fetch(`/dispatcher/stores/${storeId}/weights/apply`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ products: batch } satisfies WeightApplyRequest)
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const body: WeightApplyResponse = await res.json();
				for (const id of body.applied) {
					const g = edits.get(id);
					if (g !== undefined) saved.set(id, g);
					edits.delete(id);
				}
				// Changed in Shopify since load: adopt the live value as the new
				// baseline and keep the edit staged so it gets a second look.
				for (const c of body.conflicts) {
					saved.set(c.variantId, c.liveGrams);
					rowErrors.set(c.variantId, `Changed in Shopify to ${formatGrams(c.liveGrams)} — save again to overwrite`);
				}
				for (const f of body.failed) rowErrors.set(f.variantId, f.error);
				applied += body.applied.length;
				conflicts += body.conflicts.length;
				failed += body.failed.length;
			} catch (e) {
				for (const g of batch) for (const c of g.changes) rowErrors.set(c.variantId, e instanceof Error ? e.message : 'Request failed');
				failed += batchSize;
			}
			progress = { done: progress.done + batchSize, total: progress.total };
		}

		saving = false;
		if (failed === 0 && conflicts === 0) {
			reviewOpen = false;
			addToast(`Saved ${applied} weight${applied === 1 ? '' : 's'} to Shopify`);
		} else {
			addToast(`Saved ${applied} · ${conflicts} changed elsewhere · ${failed} failed`, 'error');
			filter = 'edited';
		}
	}
</script>

<svelte:head>
	<title>Weights — Pro Shipper</title>
</svelte:head>

{#snippet thumb(p: Product, v: Variant | undefined, size: string, fromReview = false)}
	{@const img = imageOf(p, v)}
	{#if img}
		<button
			type="button"
			onclick={() => openGallery(p, v, fromReview)}
			class="{size} shrink-0 overflow-hidden rounded-md border border-border transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-zoom-in"
			aria-label="View photo of {v ? variantLabel(v) : p.title}"
		>
			<img src={img.thumb} alt="" loading="lazy" class="size-full object-cover" />
		</button>
	{:else}
		<div class="{size} shrink-0 rounded-md bg-muted flex items-center justify-center border border-border">
			<ImageIcon class="size-4 text-muted-foreground" />
		</div>
	{/if}
{/snippet}

{#snippet weightCell(v: Variant)}
	{@const edited = edits.has(v.id)}
	{@const err = rowErrors.get(v.id)}
	<div class="flex items-center gap-2 justify-end">
		{#if edited}
			<span class="hidden sm:inline text-xs tabular-nums text-muted-foreground line-through">{live(v) > 0 ? live(v) : '—'}</span>
		{/if}
		<div class="relative">
			<input
				type="text"
				inputmode="decimal"
				autocomplete="off"
				data-cell={cellIndex.get(v.id)}
				value={cellValue(v)}
				placeholder="—"
				oninput={(e) => onCellInput(v, e.currentTarget.value)}
				onblur={() => onCellBlur(v)}
				onkeydown={(e) => onCellKey(e, v)}
				onfocus={(e) => e.currentTarget.select()}
				aria-label="Weight in grams for {variantLabel(v)}"
				aria-invalid={isInvalid(v) || !!err}
				class="h-9 w-24 rounded-md border bg-background pl-2.5 pr-6 text-right text-sm tabular-nums transition-colors
					focus:outline-none focus:ring-2 focus:ring-ring
					{isInvalid(v) || err ? 'border-destructive ring-1 ring-destructive/40' : edited ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : live(v) === 0 ? 'border-dashed border-border' : 'border-border'}"
			/>
			<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
		</div>
		<span class="w-4 shrink-0 flex justify-center" title={err ?? (variantMeta[v.id]?.outlier ? 'Far off the other variants — check for a typo' : '')}>
			{#if err}
				<AlertTriangleIcon class="size-4 text-destructive" />
			{:else if saved.has(v.id) && !edited}
				<CheckIcon class="size-4 text-green-600" />
			{:else if variantMeta[v.id]?.outlier}
				<AlertTriangleIcon class="size-4 text-amber-500" />
			{/if}
		</span>
	</div>
	{#if err}
		<p class="mt-1 text-right text-xs text-destructive">{err}</p>
	{/if}
{/snippet}

<div class="p-3 sm:p-6 space-y-4 {selected.size && edits.size ? 'pb-48' : selected.size || edits.size ? 'pb-28' : ''}">
	<!-- Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
		<div class="card p-4 flex items-center gap-4">
			<svg viewBox="0 0 36 36" class="size-14 shrink-0 -rotate-90" aria-hidden="true">
				<circle cx="18" cy="18" r="15.5" fill="none" class="stroke-muted" stroke-width="4" />
				<circle
					cx="18" cy="18" r="15.5" fill="none" stroke-width="4" stroke-linecap="round"
					class="{stats.coverage === 100 ? 'stroke-green-600' : 'stroke-primary'} transition-all duration-500"
					stroke-dasharray="{(stats.coverage / 100) * 97.4} 97.4"
				/>
			</svg>
			<div class="min-w-0">
				<div class="text-2xl font-bold tabular-nums">{stats.coverage}%</div>
				<div class="text-xs text-muted-foreground">{stats.weighted} / {stats.total} variants weighted</div>
			</div>
		</div>

		<button
			type="button"
			onclick={() => (filter = 'missing')}
			class="card p-4 text-left hover:border-primary/50 transition-colors {filter === 'missing' ? 'ring-2 ring-primary' : ''}"
		>
			<div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Missing weight</div>
			<div class="mt-1 text-2xl font-bold tabular-nums {stats.missing ? 'text-amber-600' : 'text-green-600'}">{stats.missing}</div>
			<div class="text-xs text-muted-foreground">{stats.missingInStock} of them in stock</div>
		</button>

		<div class="card p-4">
			<div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Products</div>
			<div class="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
				<div class="bg-green-600" style="width: {(stats.complete / Math.max(1, data.products.length)) * 100}%"></div>
				<div class="bg-amber-400" style="width: {(stats.partial / Math.max(1, data.products.length)) * 100}%"></div>
			</div>
			<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
				<span><span class="inline-block size-2 rounded-full bg-green-600 mr-1"></span>{stats.complete} complete</span>
				<span><span class="inline-block size-2 rounded-full bg-amber-400 mr-1"></span>{stats.partial} partial</span>
				<span><span class="inline-block size-2 rounded-full bg-muted-foreground/30 mr-1"></span>{stats.none} none</span>
			</div>
		</div>

		<div class="card p-4">
			<div class="flex items-baseline justify-between gap-2">
				<div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribution</div>
				<div class="text-xs text-muted-foreground tabular-nums">median {formatGrams(stats.median)}</div>
			</div>
			<div class="mt-2 flex items-end gap-1 h-10">
				{#each stats.buckets as b (b.label)}
					<div class="flex-1 rounded-sm bg-primary/70" style="height: {Math.max(4, (b.count / stats.bucketMax) * 100)}%" title="{b.label}: {b.count}"></div>
				{/each}
			</div>
			<div class="mt-1 flex gap-1 text-[10px] text-muted-foreground">
				{#each stats.buckets as b (b.label)}
					<div class="flex-1 text-center truncate">{b.label}</div>
				{/each}
			</div>
		</div>
	</div>

	{#if stats.outliers > 0 || stats.nonGram > 0}
		<div class="flex flex-wrap gap-2 text-xs">
			{#if stats.outliers > 0}
				<button type="button" onclick={() => (filter = 'outliers')} class="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 hover:bg-amber-100">
					<AlertTriangleIcon class="size-3.5" />
					{stats.outliers} variant{stats.outliers === 1 ? '' : 's'} far off their siblings — possible typos
				</button>
			{/if}
			{#if stats.nonGram > 0}
				<span class="inline-flex items-center rounded-full border border-border px-3 py-1 text-muted-foreground">
					{stats.nonGram} stored in kg/lb/oz in Shopify — saved as grams when edited
				</span>
			{/if}
			{#if stats.heaviest}
				<span class="inline-flex items-center rounded-full border border-border px-3 py-1 text-muted-foreground truncate max-w-full">
					Heaviest: {stats.heaviest.title} · {formatGrams(stats.heaviest.grams)}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Toolbar -->
	<div class="card p-3 space-y-3">
		<div class="flex flex-col sm:flex-row gap-2">
			<div class="relative flex-1">
				<SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<input
					type="search"
					bind:value={search}
					placeholder="Search product, variant or SKU…"
					class="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>
			<select
				bind:value={collectionId}
				class="h-9 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
				aria-label="Collection"
			>
				<option value="all">All collections</option>
				{#each data.collections as c (c.id)}
					<option value={c.id}>{c.title}</option>
				{/each}
			</select>
		</div>
		<div class="-mx-3 px-3 overflow-x-auto">
			<div class="inline-flex gap-2 flex-nowrap">
				{#each filterChips as chip (chip.key)}
					{@const active = filter === chip.key}
					<button
						type="button"
						onclick={() => (filter = chip.key)}
						class="inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors
							{active ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}"
					>
						{chip.label}
						<span class="min-w-[1.25rem] rounded-full px-1.5 text-xs tabular-nums {active ? 'bg-primary-foreground/20' : 'bg-muted'}">{chip.count}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- List -->
	{#if visible.length === 0}
		<div class="card p-12 text-center">
			{#if filter === 'missing' && stats.missing === 0}
				<CheckIcon class="size-10 mx-auto mb-3 text-green-600" />
				<h3 class="font-semibold">Every variant has a weight</h3>
			{:else}
				<h3 class="font-semibold">Nothing matches</h3>
				<p class="text-sm text-muted-foreground">Try a different filter or search.</p>
			{/if}
		</div>
	{:else}
		<div class="card overflow-hidden {compact ? 'lg:max-w-[800px]' : ''}">
			<div class="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 text-xs text-muted-foreground">
				<Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />
				<span>{visibleVariants.length} variant{visibleVariants.length === 1 ? '' : 's'} shown</span>
				<span class="ml-auto hidden sm:inline">Enter / ↓ next · ↑ previous · Esc undo cell</span>
				<button
					type="button"
					onclick={toggleCompact}
					class="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
					title={compact ? 'Use full width' : 'Narrow the list so weights sit next to names'}
				>
					{#if compact}<Maximize2Icon class="size-3.5" />Full width{:else}<Minimize2Icon class="size-3.5" />Compact{/if}
				</button>
			</div>
			<div class="divide-y divide-border">
				{#each visible as group (group.product.id)}
					{@const p = group.product}
					{@const single = isSingle(p)}
					{@const weightedCount = p.variants.filter((v) => live(v) > 0).length}
					{@const productSelected = group.variants.every((v) => selected.has(v.id))}
					<div>
						<div class="flex items-center gap-3 px-4 py-3">
							<Checkbox checked={productSelected} onCheckedChange={(on) => toggleProduct(group.variants, on)} />
							{@render thumb(p, single ? p.variants[0] : undefined, 'size-10')}
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="font-medium text-sm truncate">{p.title}</span>
									{#if p.status === 'DRAFT'}
										<span class="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">Draft</span>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">
									{#if single}
										{p.variants[0].sku ? `${p.variants[0].sku} · ` : ''}{p.variants[0].inventoryQuantity} in stock
									{:else}
										<span class="inline-flex items-center gap-1.5">
											<span class="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-muted">
												<span class="block h-full {weightedCount === p.variants.length ? 'bg-green-600' : 'bg-amber-400'}" style="width: {(weightedCount / p.variants.length) * 100}%"></span>
											</span>
											{weightedCount}/{p.variants.length} weighted
										</span>
									{/if}
								</div>
							</div>
							{#if single}
								<div class="shrink-0">{@render weightCell(p.variants[0])}</div>
							{/if}
						</div>
						{#if !single}
							<div class="pb-2">
								{#each group.variants as v (v.id)}
									<div class="flex items-center gap-3 pl-4 sm:pl-12 pr-4 py-1.5 hover:bg-muted/30">
										<Checkbox checked={selected.has(v.id)} onCheckedChange={(on) => toggleProduct([v], on)} />
										{@render thumb(p, v, 'size-8')}
										<div class="flex-1 min-w-0">
											<div class="text-sm truncate">{variantLabel(v)}</div>
											<div class="text-xs text-muted-foreground truncate">
												{v.sku ? `${v.sku} · ` : ''}{v.inventoryQuantity} in stock
											</div>
										</div>
										<div class="shrink-0">{@render weightCell(v)}</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Bottom bars: bulk actions (selection) and save (pending edits) -->
{#if selected.size > 0 || edits.size > 0}
	<!-- Fixed, not sticky: the store layout's scroll wrapper never actually
	     scrolls (the window does), so sticky would leave this at the end of
	     the list. Clears the sidebar on desktop and the bottom nav on mobile. -->
	<div class="fixed inset-x-0 bottom-16 lg:bottom-0 lg:left-56 z-30 px-3 sm:px-6 pb-3 space-y-2 pointer-events-none">
		{#if selected.size > 0}
			<form
				class="pointer-events-auto card shadow-lg p-3 flex items-center gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					setSelected();
				}}
			>
				<span class="text-sm font-medium truncate">Set <span class="tabular-nums">{selected.size}</span> selected to</span>
				<div class="relative shrink-0">
					<input
						type="text"
						inputmode="decimal"
						bind:value={bulkValue}
						placeholder="450"
						class="h-8 w-24 rounded-md border bg-background pl-2.5 pr-6 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring
							{bulkValue && bulkGrams === null ? 'border-destructive' : 'border-border'}"
						aria-label="Weight in grams for selected variants"
					/>
					<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
				</div>
				<Button type="submit" size="sm" disabled={bulkGrams === null}>Set</Button>
				<Button type="button" size="icon-sm" variant="ghost" class="ml-auto" title="Clear selection" onclick={() => selected.clear()}>
					<XIcon />
				</Button>
			</form>
		{/if}
		{#if edits.size > 0}
			<div class="pointer-events-auto card shadow-lg p-3 flex items-center gap-3 border-amber-300">
				<div class="text-sm">
					<span class="font-semibold tabular-nums">{edits.size}</span> unsaved change{edits.size === 1 ? '' : 's'}
					{#if warningCount}
						<span class="ml-2 inline-flex items-center gap-1 text-amber-600"><AlertTriangleIcon class="size-3.5" />{warningCount} to check</span>
					{/if}
				</div>
				<div class="ml-auto flex gap-2">
					<Button size="sm" variant="outline" onclick={discardAll}>Discard</Button>
					<Button size="sm" onclick={() => (reviewOpen = true)}>Review &amp; save</Button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<Dialog.Root bind:open={reviewOpen}>
	<Dialog.Content class="sm:max-w-2xl max-h-[85vh] flex flex-col">
		<Dialog.Header>
			<Dialog.Title>Save {pending.length} weight{pending.length === 1 ? '' : 's'} to Shopify</Dialog.Title>
			<Dialog.Description>
				Updates the variant weight in Shopify (in grams). Takes effect immediately for shipping and courier bookings.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 overflow-y-auto -mx-6 px-6 divide-y divide-border border-y border-border">
			{#each [...pending].sort((a, b) => Number(!!b.warning) - Number(!!a.warning)) as r (r.variant.id)}
				<div class="flex items-center gap-3 py-2 text-sm">
					{@render thumb(r.product, isSingle(r.product) ? undefined : r.variant, 'size-9', true)}
					<div class="flex-1 min-w-0">
						<div class="truncate">{r.product.title}</div>
						{#if !isSingle(r.product)}
							<div class="text-xs text-muted-foreground truncate">{variantLabel(r.variant)}</div>
						{/if}
					</div>
					{#if r.warning}
						<span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
							<AlertTriangleIcon class="size-3" />{r.warning}
						</span>
					{/if}
					<div class="shrink-0 tabular-nums text-right w-36">
						<span class="text-muted-foreground">{r.from > 0 ? formatGrams(r.from) : '—'}</span>
						<span class="mx-1 text-muted-foreground">→</span>
						<span class="font-semibold">{formatGrams(r.to)}</span>
					</div>
					{#if rowErrors.get(r.variant.id)}
						<span title={rowErrors.get(r.variant.id)}><AlertTriangleIcon class="size-4 text-destructive shrink-0" /></span>
					{/if}
				</div>
			{/each}
		</div>

		{#if saving}
			<div class="space-y-1">
				<div class="h-2 overflow-hidden rounded-full bg-muted">
					<div class="h-full bg-primary transition-all" style="width: {(progress.done / Math.max(1, progress.total)) * 100}%"></div>
				</div>
				<div class="text-xs text-muted-foreground tabular-nums">{progress.done} / {progress.total}</div>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" disabled={saving} onclick={() => (reviewOpen = false)}>Keep editing</Button>
			<Button disabled={saving || pending.length === 0} onclick={saveAll}>
				{#if saving}<Loader2Icon class="animate-spin" />Saving…{:else}Save to Shopify{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Lightbox bind:url={lightboxUrl} items={lightboxItems} bind:index={lightboxIndex} />
