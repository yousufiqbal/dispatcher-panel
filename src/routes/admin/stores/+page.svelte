<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import AvatarInitial from '$lib/components/AvatarInitial.svelte';
	import EmptyStateCard from '$lib/components/EmptyStateCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import StoreIcon from '@lucide/svelte/icons/store';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
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
		<Button href="/admin/stores/new">
			<PlusIcon class="size-4" />
			Add Store
		</Button>
	</div>

	{#if data.stores.length === 0}
		<EmptyStateCard
			icon={StoreIcon}
			title="No stores yet"
			description="Add your first Shopify store to get started."
			ctaLabel="Add Store"
			ctaHref="/admin/stores/new"
		/>
	{:else}
		<div class="card">
			<div class="divide-y divide-border">
				{#each data.stores as store}
					<a href="/admin/stores/{store.id}" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors duration-100">
						<div class="flex items-center gap-4">
							<AvatarInitial name={store.name} />
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
							<ChevronRightIcon class="size-4 text-muted-foreground shrink-0" />
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
