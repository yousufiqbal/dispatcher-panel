<script lang="ts">
	import Checkbox from '$lib/components/Checkbox.svelte';
	import { addToast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let enabledMap = $state(new Map(data.activityTypes.map((t) => [t.action, t.enabled])));

	const viewTypes = data.activityTypes.filter((t) => t.isView);
	const mutationTypes = data.activityTypes.filter((t) => !t.isView);

	async function toggle(action: string, next: boolean) {
		enabledMap.set(action, next);
		enabledMap = new Map(enabledMap);
		const fd = new FormData();
		fd.set('action', action);
		fd.set('enabled', String(next));
		const res = await fetch('?/toggle', { method: 'POST', body: fd });
		addToast(res.ok ? 'Saved' : 'Failed to save', res.ok ? undefined : 'error');
	}
</script>

<svelte:head>
	<title>Activity Log Settings — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/settings" class="btn-secondary btn-icon shrink-0" title="Back to Settings">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Activity Log</h1>
		</div>
		<p class="text-sm text-muted-foreground mt-1">
			Choose which dispatcher activities get recorded in the audit log. This is stored locally and never touches Shopify.
		</p>
	</div>

	<div class="card mb-6">
		<div class="card-header">
			<h2 class="text-base font-semibold">Viewing Activity</h2>
			<p class="text-sm text-muted-foreground">Off by default — can be high volume.</p>
		</div>
		<div class="divide-y divide-border">
			{#each viewTypes as t (t.action)}
				<div class="flex items-center justify-between px-5 py-3">
					<span class="text-sm">{t.label}</span>
					<Checkbox checked={enabledMap.get(t.action) ?? false} onCheckedChange={(v) => toggle(t.action, v)} />
				</div>
			{/each}
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h2 class="text-base font-semibold">Actions</h2>
			<p class="text-sm text-muted-foreground">On by default.</p>
		</div>
		<div class="divide-y divide-border">
			{#each mutationTypes as t (t.action)}
				<div class="flex items-center justify-between px-5 py-3">
					<span class="text-sm">{t.label}</span>
					<Checkbox checked={enabledMap.get(t.action) ?? false} onCheckedChange={(v) => toggle(t.action, v)} />
				</div>
			{/each}
		</div>
	</div>
</div>
