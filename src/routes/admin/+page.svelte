<script lang="ts">
	import { formatDate } from '$lib/utils';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Admin Overview — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-foreground">Overview</h1>
		<p class="text-muted-foreground text-sm mt-1">System status at a glance</p>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
		<div class="card p-5">
			<div class="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Dispatchers</div>
			<div class="text-3xl font-bold text-foreground">{data.activeDispatcherCount}</div>
		</div>
		<div class="card p-5">
			<div class="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Stores</div>
			<div class="text-3xl font-bold text-foreground">{data.activeStoreCount}</div>
		</div>
	</div>

	<!-- Quick actions -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
		<a href="/admin/dispatchers/new" class="card p-5 hover:shadow-md transition-shadow duration-150 group">
			<div class="flex items-center gap-3">
				<div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-150">
					<UserPlusIcon class="size-5" />
				</div>
				<div>
					<div class="font-semibold text-sm text-foreground">Add Dispatcher</div>
					<div class="text-xs text-muted-foreground">Create a new dispatcher account</div>
				</div>
			</div>
		</a>

		<a href="/admin/stores/new" class="card p-5 hover:shadow-md transition-shadow duration-150 group">
			<div class="flex items-center gap-3">
				<div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-150">
					<PlusIcon class="size-5" />
				</div>
				<div>
					<div class="font-semibold text-sm text-foreground">Add Store</div>
					<div class="text-xs text-muted-foreground">Connect a Shopify store</div>
				</div>
			</div>
		</a>
	</div>

	<!-- Recent activity -->
	{#if data.recentAudit.length > 0}
		<div class="card">
			<div class="card-header">
				<h2 class="text-base font-semibold">Recent Activity</h2>
			</div>
			<div class="card-content">
				<div class="space-y-2">
					{#each data.recentAudit as entry}
						<div class="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
							<div>
								<span class="font-medium text-foreground">{entry.action}</span>
								{#if entry.targetId}
									<span class="text-muted-foreground ml-1">→ {entry.targetId.slice(0, 12)}…</span>
								{/if}
							</div>
							<span class="text-xs text-muted-foreground">{formatDate(entry.createdAt.toISOString())}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
