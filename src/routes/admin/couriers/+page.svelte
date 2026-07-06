<script lang="ts">
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
		<a href="/admin/couriers/new" class="btn-primary">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
			</svg>
			Add Courier
		</a>
	</div>

	{#if data.couriers.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No couriers yet</h3>
			<p class="text-sm text-muted-foreground mb-4">Add PostEx, DEX, or another courier account and assign it to stores.</p>
			<a href="/admin/couriers/new" class="btn-primary">Add Courier</a>
		</div>
	{:else}
		<div class="card">
			<div class="divide-y divide-border">
				{#each data.couriers as c}
					<div class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
						<div class="flex items-center gap-4">
							<div class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
								{c.name[0].toUpperCase()}
							</div>
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
						<a href="/admin/couriers/{c.id}" class="btn-secondary btn-sm">Edit</a>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
