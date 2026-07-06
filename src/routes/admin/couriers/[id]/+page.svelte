<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.courier.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/couriers" class="btn-secondary btn-icon shrink-0" title="Back to Couriers">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
				{data.courier.name[0].toUpperCase()}
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold">{data.courier.name}</h1>
					<span class="badge-partial text-xs">{data.courier.providerLabel}</span>
					{#if data.courier.enabled}
						<span class="badge badge-fulfilled">Enabled</span>
					{:else}
						<span class="badge badge-cancelled">Disabled</span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="card mb-4">
		<div class="card-header">
			<h2 class="text-sm font-semibold">Courier Details</h2>
		</div>
		<div class="card-content space-y-3 text-sm">
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Provider</div>
				<div>{data.courier.providerLabel}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">API Key</div>
				<div>{data.courier.hasApiKey ? 'Configured' : 'Not set'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Default Weight</div>
				<div>{data.courier.defaultWeight ?? '—'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Fragile by Default</div>
				<div>{data.courier.defaultFragile ? 'Yes' : 'No'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Default Note</div>
				<div>{data.courier.defaultNote ?? '—'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Added</div>
				<div>{formatDateShort(data.courier.createdAt.toISOString())}</div>
			</div>
		</div>
	</div>

	<!-- Store assignment link -->
	<a href="/admin/couriers/{data.courier.id}/stores" class="card mb-6 flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
		<div>
			<div class="font-semibold text-sm text-foreground">Assigned Stores</div>
			{#if data.stores.length === 0}
				<div class="text-xs text-muted-foreground mt-0.5">Not assigned to any store</div>
			{:else}
				<div class="flex flex-wrap gap-1 mt-1">
					{#each data.stores as s}
						<span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{s.name}</span>
					{/each}
				</div>
			{/if}
		</div>
		<svg class="size-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	</a>

	<a href="/admin/couriers/{data.courier.id}/edit" class="btn-primary">
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
		</svg>
		Edit Courier
	</a>
</div>
