<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let {
		url = $bindable(null),
		alt = ''
	}: {
		url: string | null;
		alt?: string;
	} = $props();
</script>

{#if url}
	<div
		class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onclick={() => url = null}
		onkeydown={(e) => e.key === 'Escape' && (url = null)}
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
		<div
			class="relative max-w-4xl max-h-full"
			onclick={(e) => e.stopPropagation()}
			in:scale={{ duration: 220, start: 0.9, easing: quintOut }}
			out:scale={{ duration: 150, start: 0.9 }}
		>
			<img src={url} alt={alt} class="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain" />
			{#if alt}
				<p class="text-white/60 text-sm text-center mt-3">{alt}</p>
			{/if}
		</div>
	</div>
{/if}
