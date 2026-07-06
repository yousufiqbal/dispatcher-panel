<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.store.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/stores" class="btn-secondary btn-icon shrink-0" title="Back to Stores">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			{#if data.store.iconUrl}
				<img src={data.store.iconUrl} alt="" class="size-10 rounded-lg object-contain border border-border shrink-0" />
			{:else}
				<div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
					{data.store.name[0].toUpperCase()}
				</div>
			{/if}
			<div>
				<h1 class="text-2xl font-bold">{data.store.name}</h1>
				<div class="flex items-center gap-2 mt-1">
					{#if data.store.isActive}
						<span class="badge badge-fulfilled">Active</span>
					{:else}
						<span class="badge badge-cancelled">Inactive</span>
					{/if}
					<p class="text-sm text-muted-foreground">{data.store.shopifyDomain}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="card mb-4">
		<div class="card-header">
			<h2 class="text-sm font-semibold">Store Details</h2>
		</div>
		<div class="card-content space-y-3 text-sm">
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Shopify Domain</div>
				<div class="font-mono">{data.store.shopifyDomain}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">OAuth Client ID</div>
				<div class="font-mono">{data.store.oauthClientId ?? '—'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">OAuth App</div>
				<div>{data.store.hasOauthApp ? 'Configured' : 'Not set up'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Added</div>
				<div>{formatDateShort(data.store.createdAt.toISOString())}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Last Updated</div>
				<div>{formatDateShort(data.store.updatedAt.toISOString())}</div>
			</div>
		</div>
	</div>

	<div class="card mb-6">
		<div class="card-header">
			<h2 class="text-sm font-semibold">Dispatchers with Access</h2>
		</div>
		<div class="card-content">
			{#if data.dispatchers.length === 0}
				<p class="text-sm text-muted-foreground">No dispatchers assigned to this store.</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each data.dispatchers as d}
						<a href="/admin/dispatchers/{d.id}" class="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors">{d.name}</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<a href="/admin/stores/{data.store.id}/edit" class="btn-primary">
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
		</svg>
		Edit Store
	</a>
</div>
