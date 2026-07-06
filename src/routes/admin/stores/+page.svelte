<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Stores — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold">Stores</h1>
			<p class="text-sm text-muted-foreground mt-1">{data.stores.length} connected store{data.stores.length !== 1 ? 's' : ''}</p>
		</div>
		<a href="/admin/stores/new" class="btn-primary">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
			Add Store
		</a>
	</div>

	{#if data.stores.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No stores yet</h3>
			<p class="text-sm text-muted-foreground mb-4">Add your first Shopify store to get started.</p>
			<a href="/admin/stores/new" class="btn-primary">Add Store</a>
		</div>
	{:else}
		<div class="card">
			<div class="divide-y divide-border">
				{#each data.stores as store}
					<div class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors duration-100">
						<div class="flex items-center gap-4">
							<div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
								{store.name[0].toUpperCase()}
							</div>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-semibold text-sm text-foreground">{store.name}</span>
									{#if store.isActive}
										<span class="badge badge-fulfilled">Active</span>
									{:else}
										<span class="badge badge-cancelled">Inactive</span>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">{store.shopifyDomain}</div>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-xs text-muted-foreground hidden sm:block">Added {formatDateShort(store.createdAt.toISOString())}</span>
							<a href="/admin/stores/{store.id}" class="btn-secondary btn-sm">Edit</a>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
