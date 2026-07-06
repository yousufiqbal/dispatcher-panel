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

	function selectActor(newRole: string, newActorId: string) {
		role = newRole;
		actorId = newActorId;
		applyFilters();
	}

	const pills = $derived([
		{ label: 'All', role: '', actorId: '' },
		{ label: 'Admin', role: 'admin', actorId: '' },
		...data.dispatchers.map((d) => ({ label: d.name, role: 'dispatcher', actorId: d.id }))
	]);

	let selectedLog = $state<PageData['logs'][number] | null>(null);

	function formatMetadata(metadata: string | null) {
		if (!metadata) return null;
		try {
			return JSON.stringify(JSON.parse(metadata), null, 2);
		} catch {
			return metadata;
		}
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
		{#each pills as pill}
			<button
				onclick={() => selectActor(pill.role, pill.actorId)}
				class="px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap
					{role === pill.role && actorId === pill.actorId
						? 'bg-primary text-primary-foreground'
						: 'bg-zinc-200/70 text-muted-foreground hover:bg-accent'}"
			>
				{pill.label}
			</button>
		{/each}
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
							<tr class="hover:bg-muted/20 cursor-pointer" onclick={() => selectedLog = log}>
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
					<button class="w-full text-left px-4 py-3 hover:bg-muted/20" onclick={() => selectedLog = log}>
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
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

{#if selectedLog}
	<div
		class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onclick={() => selectedLog = null}
		onkeydown={(e) => e.key === 'Escape' && (selectedLog = null)}
		tabindex="-1"
	>
		<div class="card w-full max-w-lg shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="card-header flex items-center justify-between">
				<h2 class="text-lg font-semibold">Audit Entry</h2>
				<button class="btn-icon text-muted-foreground" onclick={() => selectedLog = null}>
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="card-content space-y-3 text-sm">
				<div>
					<div class="text-xs text-muted-foreground uppercase tracking-wide">When</div>
					<div class="font-mono">{formatDate(selectedLog.createdAt.toISOString())}</div>
				</div>
				<div>
					<div class="text-xs text-muted-foreground uppercase tracking-wide">Actor</div>
					<div>
						<span class="badge {selectedLog.actorRole === 'admin' ? 'badge-partial' : 'badge-pending'}">{selectedLog.actorRole}</span>
						<span class="ml-2 font-mono text-xs break-all">{selectedLog.actorId}</span>
					</div>
				</div>
				<div>
					<div class="text-xs text-muted-foreground uppercase tracking-wide">Action</div>
					<div class="font-mono">{selectedLog.action}</div>
				</div>
				{#if selectedLog.targetType || selectedLog.targetId}
					<div>
						<div class="text-xs text-muted-foreground uppercase tracking-wide">Target</div>
						<div class="font-mono text-xs break-all">
							{selectedLog.targetType ? `${selectedLog.targetType}: ` : ''}{selectedLog.targetId ?? '—'}
						</div>
					</div>
				{/if}
				{#if formatMetadata(selectedLog.metadata)}
					<div>
						<div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Metadata</div>
						<pre class="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">{formatMetadata(selectedLog.metadata)}</pre>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
