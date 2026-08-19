<script lang="ts">
	import { fade, scale, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	export interface LightboxItem {
		url: string;
		alt?: string;
		title?: string;
		subtitle?: string | null;
		quantity?: number;
	}

	// `items`/`index` are optional — when given, the lightbox becomes a small
	// gallery (prev/next, serial count, title/variant/quantity footer) instead
	// of a single static image. `url` still gates open/close either way, so
	// existing single-image callers don't need to change.
	let {
		url = $bindable(null),
		alt = '',
		items,
		index = $bindable(0)
	}: {
		url: string | null;
		alt?: string;
		items?: LightboxItem[];
		index?: number;
	} = $props();

	const hasNav = $derived(!!items && items.length > 0);
	const current = $derived(hasNav ? items![Math.min(Math.max(index, 0), items!.length - 1)] : null);
	const displayUrl = $derived(current?.url ?? url);
	const displayAlt = $derived(current?.alt ?? alt);

	// Which way the next image should slide in from — 1 = next (from the
	// right), -1 = prev (from the left).
	let direction = $state(1);

	function goPrev() {
		if (hasNav && index > 0) { direction = -1; index -= 1; }
	}
	function goNext() {
		if (hasNav && items && index < items.length - 1) { direction = 1; index += 1; }
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { url = null; return; }
		if (!hasNav) return;
		if (e.key === 'ArrowRight') goNext();
		if (e.key === 'ArrowLeft') goPrev();
	}

	let dialogEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (url) dialogEl?.focus();
	});
</script>

{#if url}
	<div
		bind:this={dialogEl}
		class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 outline-none"
		role="dialog"
		aria-modal="true"
		onclick={() => url = null}
		onkeydown={onKeydown}
		tabindex="-1"
		transition:fade={{ duration: 180 }}
	>
		<button
			class="fixed top-4 right-4 text-white/70 hover:text-white text-sm flex items-center gap-1 z-10"
			onclick={() => url = null}
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
			Close
		</button>

		{#if hasNav}
			<span class="fixed top-4 left-1/2 -translate-x-1/2 text-white/90 text-base font-semibold tabular-nums bg-white/10 rounded-full px-4 py-1.5 z-10">
				{index + 1} / {items!.length}
			</span>
		{/if}

		<div
			class="relative max-w-4xl max-h-full flex items-center gap-2 sm:gap-4"
			onclick={(e) => e.stopPropagation()}
			in:scale={{ duration: 220, start: 0.9, easing: quintOut }}
		>
			{#if hasNav}
				<button
					type="button"
					disabled={index === 0}
					onclick={goPrev}
					class="shrink-0 text-white/70 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-opacity p-1.5 rounded-full hover:bg-white/10"
					aria-label="Previous"
				>
					<ChevronLeftIcon class="size-7" />
				</button>
			{/if}

			<div class="min-w-0 grid">
				{#key hasNav ? index : displayUrl}
					<div
						class="col-start-1 row-start-1"
						in:fly={{ x: hasNav ? 60 * direction : 0, duration: 260, easing: quintOut }}
						out:fly={{ x: hasNav ? -60 * direction : 0, duration: 260, easing: quintOut }}
					>
						<img src={displayUrl} alt={displayAlt} class="max-h-[70vh] max-w-full rounded-xl shadow-2xl object-contain mx-auto" />
						{#if hasNav && current}
							<div class="text-center mt-3 space-y-1">
								<p class="text-white font-medium text-sm">{current.title}</p>
								<div class="flex items-center justify-center gap-1.5">
									{#if current.subtitle}
										<span class="inline-block px-1.5 py-0.5 rounded bg-white/15 text-white/90 text-xs font-semibold">{current.subtitle}</span>
									{/if}
									{#if current.quantity}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold">
											×{current.quantity}
										</span>
									{/if}
								</div>
							</div>
						{:else if alt}
							<p class="text-white/60 text-sm text-center mt-3">{alt}</p>
						{/if}
					</div>
				{/key}
			</div>

			{#if hasNav}
				<button
					type="button"
					disabled={index === items!.length - 1}
					onclick={goNext}
					class="shrink-0 text-white/70 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-opacity p-1.5 rounded-full hover:bg-white/10"
					aria-label="Next"
				>
					<ChevronRightIcon class="size-7" />
				</button>
			{/if}
		</div>
	</div>
{/if}
