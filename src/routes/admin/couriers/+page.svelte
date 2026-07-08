<script lang="ts">
	import AvatarInitial from '$lib/components/AvatarInitial.svelte';
	import EmptyStateCard from '$lib/components/EmptyStateCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TruckIcon from '@lucide/svelte/icons/truck';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Couriers — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold">Couriers</h1>
			<p class="text-sm text-muted-foreground mt-1">{data.couriers.length} courier{data.couriers.length !== 1 ? 's' : ''}</p>
		</div>
		<Button href="/admin/couriers/new">
			<PlusIcon class="size-4" />
			Add Courier
		</Button>
	</div>

	{#if data.couriers.length === 0}
		<EmptyStateCard
			icon={TruckIcon}
			title="No couriers yet"
			description="Add PostEx, DEX, or another courier account and assign it to stores."
			ctaLabel="Add Courier"
			ctaHref="/admin/couriers/new"
		/>
	{:else}
		<div class="card">
			<div class="divide-y divide-border">
				{#each data.couriers as c}
					<a href="/admin/couriers/{c.id}" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
						<div class="flex items-center gap-4">
							<AvatarInitial name={c.name} />
							<div>
								<div class="flex items-center gap-2">
									<span class="font-semibold text-sm text-foreground">{c.name}</span>
									<span class="badge-partial text-xs">{c.providerLabel}</span>
									{#if c.enabled}
										<span class="badge badge-fulfilled">Enabled</span>
									{:else}
										<span class="badge badge-cancelled">Disabled</span>
									{/if}
								</div>
								{#if c.stores.length > 0}
									<div class="flex flex-wrap gap-1 mt-1">
										{#each c.stores as storeName}
											<span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{storeName}</span>
										{/each}
									</div>
								{:else}
									<div class="text-xs text-muted-foreground mt-1">Not assigned to any store</div>
								{/if}
							</div>
						</div>
						<ChevronRightIcon class="size-4 text-muted-foreground shrink-0" />
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
