<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import AvatarInitial from '$lib/components/AvatarInitial.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.courier.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack href="/admin/couriers" backTitle="Back to Couriers" title={data.courier.name}>
		{#snippet leading()}
			<AvatarInitial name={data.courier.name} />
		{/snippet}
		{#snippet meta()}
			<span class="badge-partial text-xs">{data.courier.providerLabel}</span>
			{#if data.courier.enabled}
				<span class="badge badge-fulfilled">Enabled</span>
			{:else}
				<span class="badge badge-cancelled">Disabled</span>
			{/if}
		{/snippet}
	</PageHeaderBack>

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
		<ChevronRightIcon class="size-5 text-muted-foreground shrink-0" />
	</a>

	<Button href="/admin/couriers/{data.courier.id}/edit">
		<PencilIcon class="size-4" />
		Edit Courier
	</Button>
</div>
