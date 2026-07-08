<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import AvatarInitial from '$lib/components/AvatarInitial.svelte';
	import EmptyStateCard from '$lib/components/EmptyStateCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
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
		<Button href="/admin/dispatchers/new">
			<UserPlusIcon class="size-4" />
			Add Dispatcher
		</Button>
	</div>

	{#if data.dispatchers.length === 0}
		<EmptyStateCard
			icon={UsersIcon}
			title="No dispatchers yet"
			description="Add your first dispatcher to give them store access."
			ctaLabel="Add Dispatcher"
			ctaHref="/admin/dispatchers/new"
		/>
	{:else}
		<div class="card">
			<div class="divide-y divide-border">
				{#each data.dispatchers as d}
					<a href="/admin/dispatchers/{d.id}" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
						<div class="flex items-center gap-4">
							<AvatarInitial name={d.name} />
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
							<ChevronRightIcon class="size-4 text-muted-foreground shrink-0" />
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
