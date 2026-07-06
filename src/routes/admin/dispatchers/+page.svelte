<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dispatchers — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold">Dispatchers</h1>
			<p class="text-sm text-muted-foreground mt-1">{data.dispatchers.length} dispatcher{data.dispatchers.length !== 1 ? 's' : ''}</p>
		</div>
		<a href="/admin/dispatchers/new" class="btn-primary">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
			</svg>
			Add Dispatcher
		</a>
	</div>

	{#if data.dispatchers.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No dispatchers yet</h3>
			<p class="text-sm text-muted-foreground mb-4">Add your first dispatcher to give them store access.</p>
			<a href="/admin/dispatchers/new" class="btn-primary">Add Dispatcher</a>
		</div>
	{:else}
		<div class="card">
			<div class="divide-y divide-border">
				{#each data.dispatchers as d}
					<div class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
						<div class="flex items-center gap-4">
							<div class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
								{d.name[0].toUpperCase()}
							</div>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-semibold text-sm text-foreground">{d.name}</span>
									{#if d.isActive}
										<span class="badge badge-fulfilled">Active</span>
									{:else}
										<span class="badge badge-cancelled">Disabled</span>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">{d.email}</div>
								{#if d.stores.length > 0}
									<div class="flex flex-wrap gap-1 mt-1">
										{#each d.stores as storeName}
											<span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{storeName}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-xs text-muted-foreground hidden sm:block">Since {formatDateShort(d.createdAt.toISOString())}</span>
							<a href="/admin/dispatchers/{d.id}" class="btn-secondary btn-sm">Edit</a>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
