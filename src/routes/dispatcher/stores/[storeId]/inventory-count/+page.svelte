<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { formatDate } from '$lib/utils';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import LockIcon from '@lucide/svelte/icons/lock';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);

	let starting = $state(false);
	let collectionId = $state('');
	let confirmDeleteId = $state<string | null>(null);
	let deleteForms = $state<Record<string, HTMLFormElement>>({});

	function confirmDelete() {
		if (!confirmDeleteId) return;
		deleteForms[confirmDeleteId]?.requestSubmit();
		confirmDeleteId = null;
	}
</script>

<svelte:head><title>Inventory Audit — Pro Shipper</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	<p class="text-sm text-muted-foreground mb-5">Count shelves against Shopify. Nothing changes in Shopify until you review the report and click Apply.</p>

	{#if form?.startError}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.startError}</div>
	{/if}

	<form
		method="POST"
		action="?/start"
		class="card p-5 mb-5 space-y-4"
		use:enhance={() => {
			starting = true;
			return async ({ update }) => { await update(); starting = false; };
		}}
	>
		<div>
			<h2 class="text-sm font-semibold text-foreground">New count session</h2>
			<p class="text-xs text-muted-foreground mt-0.5">Pick what to count. Shopify stock is read live as each product is counted.</p>
		</div>
		<div class="flex flex-col sm:flex-row sm:items-center gap-3">
			<select name="collectionId" bind:value={collectionId} class="h-9 rounded-lg border border-border bg-card px-2.5 text-sm sm:w-64">
				<option value="">All active products</option>
				{#await data.collections}
					<option disabled>Loading collections…</option>
				{:then list}
					{#each list as c (c.id)}
						<option value={c.id}>{c.title}</option>
					{/each}
				{/await}
			</select>
			{#await data.collections then list}
				<input type="hidden" name="collectionTitle" value={list.find((c) => c.id === collectionId)?.title ?? ''} />
			{/await}
			<label class="flex items-center gap-2 text-sm text-foreground">
				<input type="checkbox" name="inStockOnly" class="size-4 rounded border-border" />
				Only items Shopify shows in stock
			</label>
			<Button type="submit" disabled={starting} class="sm:ml-auto">
				{#if starting}<Loader2Icon class="size-4 animate-spin" />{:else}<PlusIcon class="size-4" />{/if}
				{starting ? 'Fetching data…' : 'Start Session'}
			</Button>
		</div>
	</form>

	{#if data.sessions.length > 0}
		<h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Previous Sessions</h2>
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.sessions as s}
				<div class="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors">
					<a
						href="/dispatcher/stores/{storeId}/inventory-count/{s.id}/{s.completedAt ? 'complete' : s.progress.resumeIndex}"
						class="flex items-center justify-between flex-1 min-w-0"
					>
						<div class="flex items-center gap-3 min-w-0">
							<span class="size-1.5 rounded-full shrink-0 {s.completedAt ? 'bg-green-500' : 'bg-amber-500'}"></span>
							<span class="text-sm text-foreground shrink-0">{formatDate(String(s.startedAt))}</span>
							<span class="text-xs text-muted-foreground truncate">{s.scopeLabel ?? 'All products'}</span>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							{#if !s.completedAt && s.progress.total > 0}
								<span class="text-xs text-muted-foreground tabular-nums">{s.progress.done}/{s.progress.total}</span>
							{/if}
							<span class="text-xs font-semibold px-2 py-0.5 rounded-full {s.appliedAt ? 'bg-blue-100 text-blue-800' : s.completedAt ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
								{s.appliedAt ? 'Applied' : s.completedAt ? 'Complete' : 'In progress'}
							</span>
						</div>
					</a>
					{#if s.appliedAt}
						<div class="ml-3 shrink-0 size-9 flex items-center justify-center text-muted-foreground/50" title="Applied to Shopify — locked">
							<LockIcon class="size-4" />
						</div>
					{:else}
					<form
						method="POST"
						action="?/delete"
						class="ml-3 shrink-0"
						bind:this={deleteForms[s.id]}
						use:enhance={() => async ({ result, update }) => {
							await update({ reset: false });
							if (result.type === 'success') addToast('Session deleted');
						}}
					>
						<input type="hidden" name="sessionId" value={s.id} />
						<Button type="button" variant="ghost" size="icon" class="text-muted-foreground hover:text-destructive" onclick={() => confirmDeleteId = s.id}>
							<Trash2Icon class="size-4" />
						</Button>
					</form>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<Dialog.Root open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) confirmDeleteId = null; }}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete session?</Dialog.Title>
			<Dialog.Description>This cannot be undone.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => confirmDeleteId = null}>Cancel</Button>
			<Button variant="destructive" onclick={confirmDelete}>Delete</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
