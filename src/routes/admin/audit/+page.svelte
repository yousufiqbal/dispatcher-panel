<script lang="ts">
	import { formatDate } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Audit Log — Admin</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Audit Log</h1>
		<p class="text-sm text-muted-foreground mt-1">Last 100 actions</p>
	</div>

	{#if data.logs.length === 0}
		<div class="card p-12 text-center">
			<p class="text-sm text-muted-foreground">No audit entries yet</p>
		</div>
	{:else}
		<div class="card overflow-hidden">
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
	{/if}
</div>
