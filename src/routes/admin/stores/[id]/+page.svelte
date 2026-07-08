<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import AvatarInitial from '$lib/components/AvatarInitial.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.store.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack href="/admin/stores" backTitle="Back to Stores" title={data.store.name}>
		{#snippet leading()}
			<AvatarInitial name={data.store.name} src={data.store.iconUrl} />
		{/snippet}
		{#snippet meta()}
			{#if data.store.isActive}
				<span class="badge badge-fulfilled">Active</span>
			{:else}
				<span class="badge badge-cancelled">Inactive</span>
			{/if}
			<p class="text-sm text-muted-foreground">{data.store.shopifyDomain}</p>
		{/snippet}
	</PageHeaderBack>

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

	<Button href="/admin/stores/{data.store.id}/edit">
		<PencilIcon class="size-4" />
		Edit Store
	</Button>
</div>
