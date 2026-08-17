<script lang="ts" module>
	type ProductRef = { index: number; title: string; done: boolean; skipped: boolean };
	const sessionDone = new Map<string, Set<number>>();
	const sessionSkipped = new Map<string, Set<number>>();
	const productsCache = new Map<string, ProductRef[]>();
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import Lightbox from '$lib/components/Lightbox.svelte';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);

	let saving = $state(false);
	let doneVersion = $state(0);

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');

	// Mirrors each variant's input value in reactive state (the +/- buttons used
	// to poke the DOM input directly) so we can show a live +N/-N delta badge
	// against currentStock as the dispatcher types or taps +/-.
	let stockInputs = $state<Record<string, string>>({});
	$effect(() => {
		const obj: Record<string, string> = {};
		for (const v of data.variants) obj[v.id] = v.newStock != null ? String(v.newStock) : '';
		stockInputs = obj;
	});
	function stockDelta(v: { id: string; currentStock: number }): number | null {
		const raw = stockInputs[v.id];
		if (raw === undefined || raw === '') return null;
		const n = parseInt(raw, 10);
		if (isNaN(n)) return null;
		return n - v.currentStock;
	}

	function markDoneLocal(index: number) {
		let set = sessionDone.get(data.session.id);
		if (!set) sessionDone.set(data.session.id, (set = new Set()));
		set.add(index);
		doneVersion++;
	}
	function localDone(index: number) {
		return sessionDone.get(data.session.id)?.has(index) ?? false;
	}
	function markSkippedLocal(index: number) {
		let set = sessionSkipped.get(data.session.id);
		if (!set) sessionSkipped.set(data.session.id, (set = new Set()));
		set.add(index);
		doneVersion++;
	}
	function localSkipped(index: number) {
		return sessionSkipped.get(data.session.id)?.has(index) ?? false;
	}

	let formEl = $state<HTMLFormElement>();
	let toast = $state(false);
	let toastTimer: ReturnType<typeof setTimeout>;

	let jumpOpen = $state(false);
	let jumpQuery = $state('');
	let products = $state<ProductRef[]>(productsCache.get(data.session.id) ?? []);

	$effect(() => {
		const sid = data.session.id;
		const cached = productsCache.get(sid);
		if (cached) { products = cached; return; }
		fetch(`/dispatcher/stores/${storeId}/inventory-count/${sid}/products`)
			.then((r) => r.json())
			.then((d: { products: ProductRef[] }) => { productsCache.set(sid, d.products); products = d.products; })
			.catch(() => {});
	});

	const productsView = $derived.by(() => {
		doneVersion;
		return products.map((p) => {
			const done = p.done || localDone(p.index);
			const skipped = !done && (p.skipped || localSkipped(p.index));
			return { ...p, done, skipped };
		});
	});
	const doneCount = $derived(productsView.filter((p) => p.done).length);
	const skippedCount = $derived(productsView.filter((p) => p.skipped).length);
	const filteredProducts = $derived.by(() => {
		const q = jumpQuery.trim().toLowerCase();
		return q ? productsView.filter((p) => p.title.toLowerCase().includes(q)) : productsView;
	});

	function jumpTo(index: number) {
		jumpOpen = false;
		jumpQuery = '';
		if (index !== data.index) navTo(index);
	}

	function showToast() {
		toast = true;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = false), 2200);
	}

	// `markDone` fills blank counts with the current system stock so the
	// product counts as reviewed (unchanged = current) once you move forward.
	function saveForm(markDone: boolean) {
		if (!formEl) return;
		const body = new FormData(formEl);
		if (markDone) {
			for (const [key, value] of [...body.entries()]) {
				if (key.startsWith('newStock_') && value === '') {
					const variantId = key.replace('newStock_', '');
					const v = data.variants.find((v) => v.id === variantId);
					body.set(key, String(v?.currentStock ?? 0));
				}
			}
			markDoneLocal(data.index);
		}
		fetch('?/save', { method: 'POST', body }).catch(() => {});
	}

	function navTo(targetIndex: number, markDone = false) {
		saveForm(markDone);
		goto(`../${data.session.id}/${targetIndex}`);
	}

	// Leaves newStock untouched (unlike Next, which fills blanks with the
	// current stock and marks the product done) — for when the product
	// physically can't be found/counted right now.
	let skipping = $state(false);
	async function skipCurrent() {
		skipping = true;
		markSkippedLocal(data.index);
		await fetch('?/skip', { method: 'POST', body: new FormData() }).catch(() => {});
		if (data.nextIndex !== null) {
			goto(`../${data.session.id}/${data.nextIndex}`);
		} else {
			await fetch('?/complete', { method: 'POST', body: new FormData() }).catch(() => {});
			goto(`/dispatcher/stores/${storeId}/inventory-count/${data.session.id}/complete`);
		}
		skipping = false;
	}

	let completeBtnEl = $state<HTMLButtonElement | null>(null);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			// Prevent the number input's default "submit the form" behavior — Enter
			// should advance to the next product instead, same as clicking Next.
			e.preventDefault();
			if (data.nextIndex !== null) navTo(data.nextIndex, true);
			else completeBtnEl?.click();
			return;
		}
		if (e.target instanceof HTMLInputElement) return;
		const { prevIndex, nextIndex } = data;
		if (e.key === 'ArrowLeft' && prevIndex !== null) navTo(prevIndex);
		if (e.key === 'ArrowRight' && nextIndex !== null) navTo(nextIndex, true);
	}

	const progress = $derived(((data.index + 1) / data.totalProducts) * 100);

	// Autofocus the first quantity input whenever a new product loads
	$effect(() => {
		data.index;
		queueMicrotask(() => {
			formEl?.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
		});
	});

	$effect(() => {
		const base = `/dispatcher/stores/${storeId}/inventory-count/${data.session.id}`;
		if (data.nextIndex !== null) preloadData(`${base}/${data.nextIndex}`);
		if (data.prevIndex !== null) preloadData(`${base}/${data.prevIndex}`);
	});
</script>

<svelte:head><title>{data.index + 1}/{data.totalProducts} {data.productTitle} — Inventory Audit</title></svelte:head>
<svelte:window onkeydown={handleKeydown} onclick={() => { if (jumpOpen) jumpOpen = false; }} />

<div class="min-h-screen bg-zinc-50 flex flex-col">
	<div class="bg-card border-b border-border sticky top-0 z-40">
		<div class="h-0.5 bg-muted">
			<div class="h-full bg-primary transition-all duration-300 ease-out" style="width: {progress}%"></div>
		</div>
		<div class="max-w-2xl mx-auto px-4 flex items-center justify-between gap-4 py-3">
			<a href="/dispatcher/stores/{storeId}/inventory-count" class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
				<ArrowLeftIcon class="size-4" />
				Sessions
			</a>
			<div class="relative">
				<button
					type="button"
					onclick={(e) => { e.stopPropagation(); jumpOpen = !jumpOpen; }}
					class="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:bg-accent px-2.5 py-1 rounded-lg transition-colors"
				>
					<span><span class="font-semibold">{data.index + 1}</span><span class="text-muted-foreground"> / {data.totalProducts}</span></span>
					<span class="text-xs text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full tabular-nums">{doneCount} done</span>
					{#if skippedCount > 0}
						<span class="text-xs text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full tabular-nums">{skippedCount} skipped</span>
					{/if}
					<ChevronDownIcon class="size-3.5 text-muted-foreground" />
				</button>

				{#if jumpOpen}
					<div
						onclick={(e) => e.stopPropagation()}
						role="menu" tabindex="-1"
						class="fixed sm:absolute left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 top-16 sm:top-auto sm:mt-2 sm:w-72 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
					>
						<div class="p-2 border-b border-border">
							<Input bind:value={jumpQuery} type="text" placeholder="Jump to product…" autofocus class="h-8 text-sm" />
						</div>
						<div class="max-h-72 overflow-y-auto py-1">
							{#each filteredProducts as p}
								<button
									type="button"
									onclick={() => jumpTo(p.index)}
									class="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors {p.index === data.index ? 'bg-accent font-medium' : ''}"
								>
									{#if p.done}
										<CheckIcon class="size-3.5 text-primary shrink-0" />
									{:else if p.skipped}
										<EyeOffIcon class="size-3.5 text-amber-600 shrink-0" />
									{:else}
										<span class="size-3.5 shrink-0 rounded-full border border-border"></span>
									{/if}
									<span class="text-muted-foreground tabular-nums text-xs w-7 shrink-0">{p.index + 1}</span>
									<span class="truncate text-foreground">{p.title}</span>
								</button>
							{:else}
								<div class="px-3 py-4 text-center text-sm text-muted-foreground">No match</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
			{#if data.session.completedAt}
				<Button href="/dispatcher/stores/{storeId}/inventory-count/{data.session.id}/complete" size="sm">
					Report
					<ChevronRightIcon class="size-3.5" />
				</Button>
			{:else}
				<div class="text-xs text-muted-foreground hidden md:block">← → keys to navigate</div>
			{/if}
		</div>
	</div>

	{#key data.index}
		<div class="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
			<div class="flex items-center gap-3 mb-4">
				{#if data.productImageUrl}
					<button type="button" onclick={() => { lightboxUrl = data.productImageUrl; lightboxAlt = data.productTitle; }} class="shrink-0 cursor-zoom-in">
						<img src={data.productImageUrl} alt={data.productTitle} class="size-12 object-cover rounded-lg border border-border bg-muted" />
					</button>
				{/if}
				<div>
					<h1 class="text-base font-semibold text-foreground leading-snug">{data.productTitle}</h1>
					<p class="text-xs text-muted-foreground mt-0.5">{data.variants.length} variant{data.variants.length > 1 ? 's' : ''}</p>
				</div>
				{#if data.variants.some((v) => v.skipped) || localSkipped(data.index)}
					<span class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
						<EyeOffIcon class="size-3" />
						Skipped
					</span>
				{/if}
			</div>

			<form method="POST" action="?/save" bind:this={formEl} use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					saving = false;
					if (result.type === 'success') showToast();
				};
			}}>
				<div class="card overflow-hidden mb-4 divide-y divide-border">
					{#each data.variants as v}
						<div class="px-4 py-3 flex flex-wrap items-center gap-3 transition-colors hover:bg-yellow-50 focus-within:bg-yellow-50">
							<div class="flex items-center gap-2.5 flex-1 min-w-0">
								{#if v.variantImageUrl}
									<button type="button" onclick={() => { lightboxUrl = v.variantImageUrl; lightboxAlt = v.variantTitle ?? data.productTitle; }} class="shrink-0 cursor-zoom-in">
										<img src={v.variantImageUrl} alt={v.variantTitle ?? ''} class="size-8 object-cover rounded-md border border-border bg-muted" />
									</button>
								{:else}
									<div class="size-8 rounded-md bg-muted shrink-0"></div>
								{/if}
								<div class="min-w-0">
									<div class="text-sm font-medium text-foreground">{v.variantTitle ?? 'Default'}</div>
									{#if v.sku}<div class="text-xs text-muted-foreground font-mono">{v.sku}</div>{/if}
								</div>
							</div>

							<div class="flex items-center gap-3 w-full sm:w-auto">
								<div class="flex items-center justify-center rounded-lg px-3 py-1.5 min-w-[44px] shrink-0 {v.currentStock === 0 ? 'bg-red-600' : 'bg-foreground'}">
									<span class="text-sm font-semibold tabular-nums text-background">{v.currentStock}</span>
								</div>

								<div class="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring/40">
									<button
										type="button"
										tabindex="-1"
										onclick={() => {
											const val = parseInt(stockInputs[v.id] !== '' ? stockInputs[v.id] : String(v.currentStock), 10);
											stockInputs[v.id] = String(Math.max(0, val - 1));
										}}
										class="px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg leading-none select-none border-r border-border"
									>−</button>
									<input
										type="number"
										name="newStock_{v.id}"
										value={stockInputs[v.id] ?? ''}
										oninput={(e) => stockInputs[v.id] = e.currentTarget.value}
										min="0"
										placeholder={String(v.currentStock)}
										class="w-12 text-foreground py-1.5 text-center text-sm font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
									/>
									<button
										type="button"
										tabindex="-1"
										onclick={() => {
											const val = parseInt(stockInputs[v.id] !== '' ? stockInputs[v.id] : String(v.currentStock), 10);
											stockInputs[v.id] = String(val + 1);
										}}
										class="px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg leading-none select-none border-l border-border"
									>+</button>
								</div>

								<span class="inline-flex items-center justify-center text-xs font-semibold tabular-nums shrink-0 w-10 h-6 rounded-md
									{stockDelta(v) && stockDelta(v)! > 0 ? 'bg-green-100 text-green-700' : stockDelta(v) && stockDelta(v)! < 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground/50'}">
									{stockDelta(v) && stockDelta(v)! > 0 ? '+' : ''}{stockDelta(v) ? stockDelta(v) : '—'}
								</span>
							</div>
						</div>
					{/each}
				</div>

				<div class="flex items-center justify-between gap-3">
					<Button type="button" variant="outline" disabled={data.prevIndex === null} onclick={() => navTo(data.prevIndex!)}>
						<ArrowLeftIcon class="size-4" />
						Previous
					</Button>

					<Button type="submit" variant="outline" disabled={saving}>
						{#if saving}<Loader2Icon class="size-3.5 animate-spin" />{/if}
						Save
					</Button>

					<Button type="button" variant="outline" disabled={skipping} onclick={skipCurrent} class="text-amber-700 border-amber-200 hover:bg-amber-50">
						{#if skipping}<Loader2Icon class="size-3.5 animate-spin" />{:else}<EyeOffIcon class="size-3.5" />{/if}
						Skip
					</Button>

					{#if data.nextIndex !== null}
						<Button type="button" onclick={() => navTo(data.nextIndex!, true)}>
							Next
							<ArrowRightIcon class="size-4" />
						</Button>
					{:else}
						<Button bind:ref={completeBtnEl} type="submit" formaction="?/complete" disabled={saving} onclick={() => saveForm(true)} class="bg-green-600 hover:bg-green-700">
							{#if saving}<Loader2Icon class="size-4 animate-spin" />{:else}Complete<CheckIcon class="size-4" />{/if}
						</Button>
					{/if}
				</div>
			</form>
		</div>
	{/key}
</div>

{#if toast}
	<div class="fixed top-5 right-5 z-50 flex items-center gap-2 bg-card border border-border text-foreground text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
		<CheckIcon class="size-4 text-green-600" />
		Saved
	</div>
{/if}

<Lightbox bind:url={lightboxUrl} alt={lightboxAlt} />
