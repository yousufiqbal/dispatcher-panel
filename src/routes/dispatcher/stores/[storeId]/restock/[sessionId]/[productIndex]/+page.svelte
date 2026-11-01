<script lang="ts" module>
	type ProductRef = { index: number; title: string; done: boolean };

	// Products marked done this browser session, keyed by sessionId. Survives
	// page navigation so the count is correct even before the save commits.
	const sessionDone = new Map<string, Set<number>>();
	// Jump-menu/progress list, fetched once per session and reused across navs.
	const productsCache = new Map<string, ProductRef[]>();
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { addToast } from '$lib/toast.svelte';
	import { urgency } from '$lib/restock-calc';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import TableIcon from '@lucide/svelte/icons/table';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	let { data } = $props();
	const storeId = $derived($page.params.storeId);

	let saving = $state(false);
	let doneVersion = $state(0);

	// Which shipment each qty is for. Re-derived per product; picking Air/Sea
	// overrides it locally until the save lands.
	let modes = $derived<Record<string, 'air' | 'sea' | null>>(
		Object.fromEntries(data.variants.map((v) => [v.id, v.restockMode]))
	);

	// Lets the Air/Sea recommendation boxes fill the qty input directly instead
	// of the dispatcher retyping the number they're already looking at.
	function setQty(variantId: string, value: number, mode: 'air' | 'sea') {
		const input = document.getElementById(`qty-${variantId}`) as HTMLInputElement | null;
		if (!input) return;
		input.value = String(value);
		modes = { ...modes, [variantId]: mode };
		input.focus();
	}

	function coverLabel(days: number | null): string {
		if (days === null) return '—';
		return days >= 365 ? '1y+' : `${Math.floor(days)}d`;
	}

	const urgencyBox: Record<string, string> = {
		critical: 'border-red-200 bg-red-50 text-red-700',
		soon: 'border-amber-200 bg-amber-50 text-amber-800',
		ok: 'border-border text-foreground',
		idle: 'border-border text-muted-foreground'
	};

	function markDoneLocal(index: number) {
		let set = sessionDone.get(data.session.id);
		if (!set) sessionDone.set(data.session.id, (set = new Set()));
		set.add(index);
		doneVersion++;
	}
	function localDone(index: number) {
		return sessionDone.get(data.session.id)?.has(index) ?? false;
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
		fetch(`/dispatcher/stores/${storeId}/restock/${sid}/products`)
			.then((r) => r.json())
			.then((d: { products: ProductRef[] }) => { productsCache.set(sid, d.products); products = d.products; })
			.catch(() => {});
	});

	const productsView = $derived.by(() => {
		doneVersion;
		return products.map((p) => ({ ...p, done: p.done || localDone(p.index) }));
	});
	const doneCount = $derived(productsView.filter((p) => p.done).length);
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

	// Save current edits in background. `markDone` fills blank qtys with 0 so the
	// product counts as reviewed once you move forward. Navigation doesn't wait
	// for it, so a failure is surfaced as a toast naming the product to revisit.
	function saveForm(markDone: boolean): Promise<void> {
		if (!formEl) return Promise.resolve();
		const body = new FormData(formEl);
		const title = data.productTitle;
		if (markDone) {
			for (const [key, value] of [...body.entries()]) {
				if (key.startsWith('actualRestock_') && value === '') body.set(key, '0');
			}
			markDoneLocal(data.index);
		}
		return fetch(`${base}/${data.index}?/save`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		})
			.then(async (res) => {
				const result = res.ok ? await res.json() : null;
				if (result?.type !== 'success') throw new Error();
			})
			.catch(() => addToast(`Couldn't save "${title}" — go back and re-enter it`, 'error'));
	}

	const base = $derived(`/dispatcher/stores/${storeId}/restock/${data.session.id}`);

	function navTo(targetIndex: number, markDone = false) {
		saveForm(markDone);
		goto(`../${data.session.id}/${targetIndex}`);
	}

	// Leaving the wizard (to the table or the final list) waits for the save,
	// otherwise the next page can load before this product's qty is stored.
	async function leaveTo(href: string) {
		saving = true;
		await saveForm(false);
		saving = false;
		goto(href);
	}

	async function finish() {
		saving = true;
		await saveForm(true);
		await fetch(`${base}/${data.index}?/complete`, { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
		saving = false;
		goto(`${base}/complete`);
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

	// Prefetch adjacent products so Next/Prev/arrow nav is instant
	$effect(() => {
		const base = `/dispatcher/stores/${storeId}/restock/${data.session.id}`;
		if (data.nextIndex !== null) preloadData(`${base}/${data.nextIndex}`);
		if (data.prevIndex !== null) preloadData(`${base}/${data.prevIndex}`);
	});
</script>

{#snippet recButton(variantId: string, mode: 'air' | 'sea', value: number, extra: string)}
	{@const picked = modes[variantId] === mode}
	<button
		type="button"
		tabindex="-1"
		title="Set restock qty to {value} ({mode === 'air' ? 'air' : 'sea'} shipment)"
		onclick={() => setQty(variantId, value, mode)}
		class="flex flex-col items-center justify-center border rounded-lg px-1 py-1.5 min-w-0 transition-colors cursor-pointer {extra}
			{mode === 'air' ? 'border-blue-100 bg-blue-50 hover:bg-blue-100 text-blue-700' : 'border-teal-100 bg-teal-50 hover:bg-teal-100 text-teal-700'}
			{picked ? (mode === 'air' ? 'ring-2 ring-blue-400' : 'ring-2 ring-teal-400') : ''}"
	>
		<span class="text-[9px] font-medium uppercase tracking-wide lg:hidden opacity-80">{mode === 'air' ? '✈Air' : '🚢Sea'}</span>
		<span class="text-sm font-semibold tabular-nums">{value}</span>
	</button>
{/snippet}

<svelte:head><title>{data.index + 1}/{data.totalProducts} {data.productTitle} — Restock</title></svelte:head>
<svelte:window onkeydown={handleKeydown} onclick={() => { if (jumpOpen) jumpOpen = false; }} />

<div class="min-h-screen bg-zinc-50 flex flex-col">
	<!-- Progress bar header -->
	<div class="bg-card border-b border-border sticky top-0 z-40">
		<div class="h-0.5 bg-muted">
			<div class="h-full bg-primary transition-all duration-300 ease-out" style="width: {progress}%"></div>
		</div>
		<div class="max-w-5xl mx-auto px-4 flex items-center justify-between gap-4 py-3">
			<a href="/dispatcher/stores/{storeId}/restock" class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
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
					<span class="text-xs text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-full tabular-nums">{doneCount} done</span>
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
										<CheckIcon class="size-3.5 text-green-600 shrink-0" />
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
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" disabled={saving} onclick={() => leaveTo(`${base}/table`)}>
					<TableIcon class="size-3.5" />
					<span class="hidden sm:inline">Table view</span>
				</Button>
				{#if data.session.completedAt}
					<Button size="sm" disabled={saving} onclick={() => leaveTo(`${base}/complete`)}>
						Restock list
						<ChevronRightIcon class="size-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</div>

	{#key data.index}
		<div class="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
			<!-- Product header -->
			<div class="flex items-center gap-4 mb-5">
				{#if data.productImageUrl}
					<img src={data.productImageUrl} alt={data.productTitle} class="size-14 object-cover rounded-xl border border-border shrink-0 bg-muted" />
				{/if}
				<div>
					<h1 class="text-xl font-bold text-foreground leading-tight">{data.productTitle}</h1>
					<p class="text-xs text-muted-foreground mt-0.5">
						{data.variants.length} variant{data.variants.length > 1 ? 's' : ''} / <span class="text-foreground font-medium">{data.variants.reduce((s, v) => s + v.sales90, 0)}</span> sold in 90d
					</p>
				</div>
			</div>

			<form method="POST" action="?/save" bind:this={formEl} use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					saving = false;
					if (result.type === 'success') showToast();
				};
			}}>
				{#if data.stockError}
					<div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900 mb-4">
						Couldn't load live stock from Shopify, so recommendations are hidden: {data.stockError}
					</div>
				{/if}
				<div class="card overflow-hidden mb-5">
					<div class="hidden lg:grid grid-cols-[200px_1fr_148px_120px] gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
						<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Variant</span>
						<div class="flex gap-2">
							<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[52px] text-center">90d</span>
							<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[52px] text-center">Avail</span>
							<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[52px] text-center">Incoming</span>
							<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[52px] text-center">Lasts</span>
						</div>
						<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Restock qty</span>
						<div class="flex gap-2">
							<span class="text-[11px] font-semibold text-blue-500 uppercase tracking-wide w-[52px] text-center">✈ Air</span>
							<span class="text-[11px] font-semibold text-teal-600 uppercase tracking-wide w-[52px] text-center">🚢 Sea</span>
						</div>
					</div>

					<div class="divide-y divide-border">
						{#each data.variants as v}
							{@const level = v.calc ? urgency(v.calc, data.lead) : 'idle'}
							{@const out = v.stock !== null && v.stock.available <= 0}
							<div class="p-4 lg:grid lg:grid-cols-[200px_1fr_148px_120px] lg:items-center lg:gap-4 transition-colors hover:bg-yellow-50 focus-within:bg-yellow-50">
								<div class="flex items-center gap-3 shrink-0 mb-2 lg:mb-0">
									{#if v.variantImageUrl}
										<img src={v.variantImageUrl} alt={v.variantTitle ?? ''} class="size-9 lg:size-11 object-cover rounded-lg border border-border bg-muted shrink-0" />
									{:else}
										<div class="size-9 lg:size-11 rounded-lg bg-muted shrink-0"></div>
									{/if}
									<div>
										<div class="text-sm font-medium text-foreground">{v.variantTitle ?? 'Default'}</div>
										{#if v.sku}<div class="text-xs text-muted-foreground font-mono">{v.sku}</div>{/if}
									</div>
								</div>

								<input type="hidden" name="mode_{v.id}" value={modes[v.id] ?? ''} />

								<div class="lg:contents">
									<div class="grid grid-cols-3 gap-1.5 lg:flex lg:gap-2 mb-2 lg:mb-0">
										<div class="flex flex-col items-center justify-center border border-border rounded-lg px-1 py-1.5 min-w-0 lg:min-w-[52px] lg:px-3" title="{v.sales30} in 30d · {v.sales60} in 60d · {v.sales90} in 90d">
											<span class="text-[9px] text-muted-foreground font-medium uppercase tracking-wide lg:hidden">90d</span>
											<span class="text-sm font-semibold text-foreground tabular-nums">{v.sales90}</span>
										</div>
										<div
											class="flex flex-col items-center justify-center border rounded-lg px-1 py-1.5 min-w-0 lg:min-w-[52px] lg:px-3 {out ? 'border-red-200 bg-red-50' : 'border-border'}"
											title={v.stock ? `${v.stock.committed} committed to unfulfilled orders` : undefined}
										>
											<span class="text-[9px] {out ? 'text-red-500' : 'text-muted-foreground'} font-medium uppercase tracking-wide lg:hidden">Avail</span>
											<span class="text-sm font-semibold tabular-nums {out ? 'text-red-600' : 'text-foreground'}">{v.stock?.available ?? '—'}</span>
										</div>
										<div class="flex flex-col items-center justify-center border border-border rounded-lg px-1 py-1.5 min-w-0 lg:min-w-[52px] lg:px-3">
											<span class="text-[9px] text-muted-foreground font-medium uppercase tracking-wide lg:hidden">Incoming</span>
											<span class="text-sm font-semibold tabular-nums {v.stock?.incoming ? 'text-violet-700' : 'text-muted-foreground'}">{v.stock?.incoming ?? '—'}</span>
										</div>
										<div
											class="flex flex-col items-center justify-center border rounded-lg px-1 py-1.5 min-w-0 lg:min-w-[52px] lg:px-3 {urgencyBox[level]}"
											title="Days until available + incoming runs out at the current sales rate"
										>
											<span class="text-[9px] font-medium uppercase tracking-wide lg:hidden opacity-80">Lasts</span>
											<span class="text-sm font-semibold tabular-nums">{coverLabel(v.calc?.coverDays ?? null)}</span>
										</div>
										{#if v.calc}
											{@render recButton(v.id, 'air', v.calc.recAir, 'lg:hidden')}
											{@render recButton(v.id, 'sea', v.calc.recSea, 'lg:hidden')}
										{/if}
									</div>

									<div class="shrink-0">
										<div class="flex items-center border border-border rounded-lg overflow-hidden w-fit focus-within:ring-2 focus-within:ring-ring/40">
											<button
												type="button"
												tabindex="-1"
												onclick={(e) => {
													const input = e.currentTarget.nextElementSibling as HTMLInputElement;
													const val = parseInt(input.value || '0', 10);
													if (val > 0) input.value = String(val - 1);
												}}
												class="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg leading-none select-none border-r border-border"
											>−</button>
											<input
												id="qty-{v.id}"
												type="number"
												name="actualRestock_{v.id}"
												value={v.actualRestock ?? ''}
												min="0"
												placeholder="0"
												class="w-14 text-foreground py-2 text-center text-base font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
											/>
											<button
												type="button"
												tabindex="-1"
												onclick={(e) => {
													const input = e.currentTarget.previousElementSibling as HTMLInputElement;
													const val = parseInt(input.value || '0', 10);
													input.value = String(val + 1);
												}}
												class="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg leading-none select-none border-l border-border"
											>+</button>
										</div>
									</div>

									<div class="hidden lg:flex gap-2">
										{#if v.calc}
											{@render recButton(v.id, 'air', v.calc.recAir, 'px-3 shrink-0 min-w-[52px]')}
											{@render recButton(v.id, 'sea', v.calc.recSea, 'px-3 shrink-0 min-w-[52px]')}
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Navigation -->
				<div class="flex items-center justify-between gap-3">
					<Button type="button" variant="outline" disabled={data.prevIndex === null} onclick={() => navTo(data.prevIndex!)}>
						<ArrowLeftIcon class="size-4" />
						Previous
					</Button>

					<Button type="submit" variant="outline" disabled={saving}>
						{#if saving}<Loader2Icon class="size-3.5 animate-spin" />{/if}
						Save
					</Button>

					{#if data.nextIndex !== null}
						<Button type="button" onclick={() => navTo(data.nextIndex!, true)}>
							Next
							<ArrowRightIcon class="size-4" />
						</Button>
					{:else}
						<Button bind:ref={completeBtnEl} type="button" disabled={saving} onclick={finish} class="bg-green-600 hover:bg-green-700">
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
		Restock quantities saved
	</div>
{/if}
