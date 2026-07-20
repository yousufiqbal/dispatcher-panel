<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Income Statement — {data.storeName}</title></svelte:head>

<div class="card border-dashed p-10 text-center">
	<p class="text-sm text-muted-foreground">Income statement coming soon — will show net sales, COGS, damages, and operating expenses once Purchases/Damages/Expenses are recorded.</p>
</div>
