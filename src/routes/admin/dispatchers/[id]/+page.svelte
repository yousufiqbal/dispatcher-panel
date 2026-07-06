<script lang="ts">
	import { formatDateShort } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.dispatcher.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/dispatchers" class="btn-secondary btn-icon shrink-0" title="Back to Dispatchers">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
				{data.dispatcher.name[0].toUpperCase()}
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold">{data.dispatcher.name}</h1>
					{#if data.dispatcher.isActive}
						<span class="badge badge-fulfilled">Active</span>
					{:else}
						<span class="badge badge-cancelled">Disabled</span>
					{/if}
				</div>
				<p class="text-sm text-muted-foreground">{data.dispatcher.email}</p>
			</div>
		</div>
	</div>

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
		<svg class="size-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	</a>

	<a href="/admin/dispatchers/{data.dispatcher.id}/edit" class="btn-primary">
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
		</svg>
		Edit Dispatcher
	</a>
</div>
