<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let role = $state(data.role);
	let actorId = $state(data.actorId);

	function applyFilters() {
		const sp = new URLSearchParams();
		if (role) sp.set('role', role);
		if (actorId) sp.set('actorId', actorId);
		goto(`?${sp}`);
	}
</script>

<svelte:head>
	<title>Audit Log — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Audit Log</h1>
		<p class="text-sm text-muted-foreground mt-1">Last 100 actions</p>
	</div>

	<div class="flex flex-wrap items-center gap-2 mb-4">
		<select
			bind:value={role}
			onchange={() => { actorId = ''; applyFilters(); }}
			class="input w-auto text-sm py-1.5"
		>
			<option value="">All actors</option>
			<option value="admin">Admin</option>
			<option value="dispatcher">Dispatcher</option>
		</select>
		{#if role === 'dispatcher'}
			<select bind:value={actorId} onchange={applyFilters} class="input w-auto text-sm py-1.5">
				<option value="">All dispatchers</option>
				{#each data.dispatchers as d (d.id)}
					<option value={d.id}>{d.name}</option>
				{/each}
			</select>
		{/if}
		{#if role || actorId}
			<button
				class="text-xs text-primary hover:underline"
				onclick={() => { role = ''; actorId = ''; applyFilters(); }}
			>
				Clear filters
			</button>
		{/if}
	</div>

	{#if data.logs.length === 0}
		<div class="card p-12 text-center">
			<p class="text-sm text-muted-foreground">No audit entries yet</p>
		</div>
	{:else}
		<!-- Desktop table -->
		<div class="card overflow-hidden hidden md:block">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/30">
							<th class="text-left px-4 py-3 font-medium text-muted-foreground">When</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
							<th class="text-left px-4 py-3 font-medium text-muted-foreground">Target</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.logs as log}
							<tr class="hover:bg-muted/20">
								<td class="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt.toISOString())}</td>
								<td class="px-4 py-3">
									<span class="badge {log.actorRole === 'admin' ? 'badge-partial' : 'badge-pending'}">{log.actorRole}</span>
									<span class="ml-2 text-xs text-muted-foreground font-mono">{log.actorId.slice(0, 8)}…</span>
								</td>
								<td class="px-4 py-3 font-mono text-xs text-foreground">{log.action}</td>
								<td class="px-4 py-3 text-xs text-muted-foreground">
									{log.targetType ? `${log.targetType}: ` : ''}{log.targetId?.slice(0, 20) ?? '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile stacked list -->
		<div class="card overflow-hidden md:hidden">
			<div class="divide-y divide-border">
				{#each data.logs as log}
					<div class="px-4 py-3">
						<div class="flex items-center justify-between gap-2 mb-1">
							<span class="font-mono text-xs font-semibold text-foreground">{log.action}</span>
							<span class="badge {log.actorRole === 'admin' ? 'badge-partial' : 'badge-pending'} shrink-0">{log.actorRole}</span>
						</div>
						<div class="text-xs text-muted-foreground">
							{log.targetType ? `${log.targetType}: ` : ''}{log.targetId?.slice(0, 20) ?? '—'}
						</div>
						<div class="flex items-center justify-between gap-2 mt-1">
							<span class="text-xs text-muted-foreground font-mono">{log.actorId.slice(0, 8)}…</span>
							<span class="text-xs text-muted-foreground">{formatDate(log.createdAt.toISOString())}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
