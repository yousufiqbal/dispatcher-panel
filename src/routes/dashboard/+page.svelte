<script lang="ts">
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';

	let { data }: { data: LayoutData } = $props();

	$effect(() => {
		// Redirect to first assigned store's orders
		if (data.assignedStores?.length > 0) {
			goto(`/dashboard/stores/${data.assignedStores[0].id}/orders`);
		}
	});
</script>

<div class="flex items-center justify-center h-full min-h-screen">
	{#if !data.assignedStores?.length}
		<div class="text-center p-8">
			<svg class="size-16 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
			</svg>
			<h2 class="text-xl font-semibold text-foreground mb-2">No stores assigned</h2>
			<p class="text-muted-foreground text-sm">Contact your administrator to get access to stores.</p>
		</div>
	{/if}
</div>
