<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Log = PageData['logs'][number];
	let selected = $state<Log | null>(null);

	function filterBy(actorId: string) {
		goto(actorId ? `?actorId=${actorId}` : '?', { keepFocus: true, noScroll: true });
	}

	function prettyMetadata(metadata: string | null): string | null {
		if (!metadata) return null;
		try {
			return JSON.stringify(JSON.parse(metadata), null, 2);
		} catch {
			return metadata;
		}
	}
</script>

<svelte:head><title>Activity</title></svelte:head>

<div class="p-3 sm:p-6 max-w-4xl mx-auto space-y-4">
	<div>
		<h1 class="text-xl font-bold text-foreground">Activity</h1>
		<p class="text-sm text-muted-foreground mt-1">Last {data.limit} actions in this panel. Only you can see this page.</p>
	</div>

	<div class="inline-flex flex-wrap items-center rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
		{#each [{ id: '', name: 'Everyone' }, ...data.people] as p (p.id)}
			<button
				type="button"
				onclick={() => filterBy(p.id)}
				class="px-3 py-1.5 rounded-md font-medium transition-colors {data.actorId === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				{p.name}
			</button>
		{/each}
	</div>

	{#if data.logs.length === 0}
		<div class="card p-12 text-center text-sm text-muted-foreground">No activity yet</div>
	{:else}
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.logs as log (log.id)}
				<button type="button" class="w-full text-left px-4 py-2.5 hover:bg-muted/30 transition-colors flex items-start gap-3" onclick={() => (selected = log)}>
					<div class="min-w-0 flex-1">
						<div class="text-sm text-foreground">
							<span class="font-medium">{log.actorName}</span>
							<span class="text-muted-foreground">·</span>
							{log.label}
						</div>
						{#if log.targetType || log.targetId}
							<div class="text-xs text-muted-foreground truncate font-mono">
								{log.targetType ? `${log.targetType}: ` : ''}{log.targetId ?? ''}
							</div>
						{/if}
					</div>
					<span class="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatDate(log.createdAt)}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<Dialog.Root open={!!selected} onOpenChange={(open) => { if (!open) selected = null; }}>
	<Dialog.Content class="sm:max-w-lg">
		{#if selected}
			<Dialog.Header>
				<Dialog.Title>{selected.label}</Dialog.Title>
				<Dialog.Description>{selected.actorName} · {formatDate(selected.createdAt)}</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-3 text-sm">
				<div>
					<div class="text-xs text-muted-foreground uppercase tracking-wide">Action</div>
					<div class="font-mono text-xs">{selected.action}</div>
				</div>
				{#if selected.targetType || selected.targetId}
					<div>
						<div class="text-xs text-muted-foreground uppercase tracking-wide">Target</div>
						<div class="font-mono text-xs break-all">{selected.targetType ? `${selected.targetType}: ` : ''}{selected.targetId ?? '—'}</div>
					</div>
				{/if}
				{#if prettyMetadata(selected.metadata)}
					<div>
						<div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Details</div>
						<pre class="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-80">{prettyMetadata(selected.metadata)}</pre>
					</div>
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
