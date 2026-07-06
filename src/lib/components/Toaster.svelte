<script lang="ts">
	import { getToasts, dismissToast } from '$lib/toast.svelte';

	const toasts = $derived(getToasts());
</script>

<div class="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
	{#each toasts as toast (toast.id)}
		<div
			class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[260px] max-w-sm toast-slide-in
				{toast.type === 'success' ? 'bg-green-600 text-white' :
				 toast.type === 'error' ? 'bg-red-600 text-white' :
				 'bg-zinc-800 text-white'}"
		>
			{#if toast.type === 'success'}
				<svg class="size-4 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{:else if toast.type === 'error'}
				<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<svg class="size-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			{/if}
			<span class="flex-1">{toast.message}</span>
			<button onclick={() => dismissToast(toast.id)} class="opacity-60 hover:opacity-100 transition-opacity">
				<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes toast-slide-in {
		from {
			opacity: 0;
			transform: translateX(calc(100% + 1.25rem));
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	:global(.toast-slide-in) {
		animation: toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
</style>
