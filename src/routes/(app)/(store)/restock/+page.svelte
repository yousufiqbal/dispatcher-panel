<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { formatDate } from '$lib/utils';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import TableIcon from '@lucide/svelte/icons/table';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let starting = $state(false);
	let savingLead = $state(false);
	let confirmDeleteId = $state<string | null>(null);
	let deleteForms = $state<Record<string, HTMLFormElement>>({});

	function confirmDelete() {
		if (!confirmDeleteId) return;
		deleteForms[confirmDeleteId]?.requestSubmit();
		confirmDeleteId = null;
	}
</script>

<svelte:head><title>Restock — Pro Shipper</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	{#if form?.startError}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.startError}</div>
	{/if}

	<!-- Start new session -->
	<div class="card p-5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div>
			<h2 class="text-sm font-semibold text-foreground">New restock session</h2>
			<p class="text-xs text-muted-foreground mt-0.5">Fetches all active products and 90 days of sales, most urgent first. Stock is read live every time you open it.</p>
		</div>
		<form method="POST" action="?/start" use:enhance={() => {
			starting = true;
			return async ({ update }) => { await update(); starting = false; };
		}}>
			<Button type="submit" disabled={starting}>
				{#if starting}<Loader2Icon class="size-4 animate-spin" />{:else}<PlusIcon class="size-4" />{/if}
				{starting ? 'Fetching data…' : 'Start Session'}
			</Button>
		</form>
	</div>

	<!-- Lead times: drive the Air / Sea recommendations -->
	<form
		method="POST"
		action="?/leadTimes"
		class="card px-5 py-3.5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2"
		use:enhance={() => {
			savingLead = true;
			return async ({ result, update }) => {
				savingLead = false;
				if (result.type === 'success') addToast('Lead times saved');
				else if (result.type === 'failure') addToast((result.data?.leadError as string) ?? "Couldn't save", 'error');
				await update({ reset: false });
			};
		}}
	>
		<div class="text-sm font-medium text-foreground" title="How many days a shipment takes to arrive — recommendations cover that wait">Lead times</div>
		<label class="flex items-center gap-1.5 text-sm text-muted-foreground">
			✈ Air
			<input name="airLeadDays" type="number" min="1" max="365" value={data.lead.airDays} required class="input h-8 w-16 px-2 text-center tabular-nums" />
			days
		</label>
		<label class="flex items-center gap-1.5 text-sm text-muted-foreground">
			🚢 Sea
			<input name="seaLeadDays" type="number" min="1" max="365" value={data.lead.seaDays} required class="input h-8 w-16 px-2 text-center tabular-nums" />
			days
		</label>
		<Button type="submit" size="sm" variant="outline" disabled={savingLead} class="ml-auto">
			{#if savingLead}<Loader2Icon class="size-3.5 animate-spin" />{/if}
			Save
		</Button>
	</form>

	<!-- Past sessions -->
	{#if data.sessions.length > 0}
		<h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Previous Sessions</h2>
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.sessions as s}
				<div class="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors">
					<a
						href="/restock/{s.id}/{s.completedAt ? 'complete' : s.progress.resumeIndex}"
						class="flex items-center justify-between flex-1 min-w-0"
					>
						<div class="flex items-center gap-3">
							<span class="size-1.5 rounded-full shrink-0 {s.completedAt ? 'bg-green-500' : 'bg-amber-500'}"></span>
							<span class="text-sm text-foreground">{formatDate(String(s.startedAt))}</span>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							{#if !s.completedAt && s.progress.total > 0}
								<span class="text-xs text-muted-foreground tabular-nums">{s.progress.done}/{s.progress.total}</span>
							{/if}
							<span class="text-xs font-semibold px-2 py-0.5 rounded-full {s.completedAt ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
								{s.completedAt ? 'Complete' : 'In progress'}
							</span>
						</div>
					</a>
					<Button href="/restock/{s.id}/table" variant="ghost" size="icon" class="ml-3 shrink-0 text-muted-foreground" title="Open in table view">
						<TableIcon class="size-4" />
					</Button>
					<form
						method="POST"
						action="?/delete"
						class="shrink-0"
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
