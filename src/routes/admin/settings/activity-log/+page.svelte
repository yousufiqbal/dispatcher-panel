<script lang="ts">
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { addToast } from '$lib/toast.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
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
		<nav class="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
			<a href="/admin/settings" class="hover:text-foreground transition-colors">Settings</a>
			<ChevronRightIcon class="size-3" />
			<span class="text-foreground font-medium">Activity Log</span>
		</nav>
		<div class="flex items-center gap-3">
			<Button href="/admin/settings" variant="outline" size="icon" class="shrink-0" title="Back to Settings">
				<ArrowLeftIcon class="size-4" />
			</Button>
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
					<Switch checked={enabledMap.get(t.action) ?? false} onCheckedChange={(v) => toggle(t.action, v)} />
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
					<Switch checked={enabledMap.get(t.action) ?? false} onCheckedChange={(v) => toggle(t.action, v)} />
				</div>
			{/each}
		</div>
	</div>
</div>
