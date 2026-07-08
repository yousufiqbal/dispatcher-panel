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
	<title>{data.dispatcher.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack href="/admin/dispatchers" backTitle="Back to Dispatchers" title={data.dispatcher.name}>
		{#snippet leading()}
			<AvatarInitial name={data.dispatcher.name} />
		{/snippet}
		{#snippet meta()}
			{#if data.dispatcher.isActive}
				<span class="badge badge-fulfilled">Active</span>
			{:else}
				<span class="badge badge-cancelled">Disabled</span>
			{/if}
			<p class="text-sm text-muted-foreground">{data.dispatcher.email}</p>
		{/snippet}
	</PageHeaderBack>

	<div class="card mb-4">
		<div class="card-header">
			<h2 class="text-sm font-semibold">Dispatcher Details</h2>
		</div>
		<div class="card-content space-y-3 text-sm">
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Email</div>
				<div>{data.dispatcher.email}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground uppercase tracking-wide">Since</div>
				<div>{formatDateShort(data.dispatcher.createdAt.toISOString())}</div>
			</div>
		</div>
	</div>

	<!-- Store access link -->
	<a href="/admin/dispatchers/{data.dispatcher.id}/stores" class="card mb-6 flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
		<div>
			<div class="font-semibold text-sm text-foreground">Store Access</div>
			{#if data.stores.length === 0}
				<div class="text-xs text-muted-foreground mt-0.5">No stores assigned</div>
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

	<Button href="/admin/dispatchers/{data.dispatcher.id}/edit">
		<PencilIcon class="size-4" />
		Edit Dispatcher
	</Button>
</div>
