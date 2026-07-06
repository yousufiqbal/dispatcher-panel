<script lang="ts">
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
	>
		<div class="relative max-w-4xl max-h-full" onclick={(e) => e.stopPropagation()}>
			<button
				class="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1"
				onclick={() => url = null}
			>
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
				Close
			</button>
			<img src={url} alt={alt} class="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain" />
			{#if alt}
				<p class="text-white/60 text-sm text-center mt-3">{alt}</p>
			{/if}
		</div>
	</div>
{/if}
