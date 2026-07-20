<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Accounting — Pro Shipper</title></svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="text-xl font-bold text-foreground mb-1">Select a store</h1>
	<p class="text-sm text-muted-foreground mb-6">Choose which store's books you want to work on.</p>

	{#if data.assignedStores.length === 0}
		<div class="card border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">No stores assigned yet. Ask an admin to grant access.</p>
		</div>
	{:else}
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.assignedStores as store}
				<a href="/accounting/stores/{store.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
					{#if store.iconUrl}
						<img src={store.iconUrl} alt="" class="size-9 rounded-lg object-cover border border-border" />
					{:else}
						<div class="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
							{store.name[0].toUpperCase()}
						</div>
					{/if}
					<span class="text-sm font-medium text-foreground">{store.name}</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
