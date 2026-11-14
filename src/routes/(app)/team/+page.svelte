<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { formatDate } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Person = PageData['people'][number];

	let addOpen = $state(false);
	let editing = $state<Person | null>(null);
	let confirm = $state<{ kind: 'disable' | 'totp'; person: Person } | null>(null);
	let busy = $state(false);

	const MESSAGES: Record<string, string> = {
		created: 'Person added',
		updated: 'Changes saved',
		enabled: 'Account enabled',
		disabled: 'Account disabled and signed out',
		totpReset: '2FA reset — they set it up again at next sign-in'
	};

	// Shared submit handler: toast the outcome, close whichever dialog sent it.
	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				addToast(MESSAGES[(result.data?.done as string) ?? ''] ?? 'Saved');
				addOpen = false;
				editing = null;
				confirm = null;
				await update();
			} else if (result.type === 'failure') {
				addToast((result.data?.error as string) ?? 'Something went wrong', 'error');
			} else {
				addToast('Something went wrong', 'error');
			}
		};
	};

	function lastActive(p: Person): string {
		return p.lastActiveAt ? formatDate(new Date(p.lastActiveAt).toISOString()) : 'No activity yet';
	}
</script>

<svelte:head><title>Team</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto space-y-4">
	<div class="flex items-end justify-between gap-3">
		<div>
			<h1 class="text-xl font-bold text-foreground">Team</h1>
			<p class="text-sm text-muted-foreground mt-1">Everyone who can sign in to this panel. Only you can see this page.</p>
		</div>
		<Button onclick={() => (addOpen = true)} class="shrink-0">
			<PlusIcon class="size-4" />
			Add person
		</Button>
	</div>

	<div class="card overflow-hidden divide-y divide-border">
		{#each data.people as p (p.id)}
			<div class="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 {p.isActive ? '' : 'opacity-60'}">
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="font-medium text-foreground">{p.name}</span>
						{#if p.isOwner}<span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Owner</span>{/if}
						{#if p.id === data.meId}<span class="text-[11px] text-muted-foreground">(you)</span>{/if}
						{#if !p.isActive}<span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Disabled</span>{/if}
						{#if !p.totpEnabled}<span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="Will be asked to set up 2FA at next sign-in">2FA pending</span>{/if}
					</div>
					<div class="text-xs text-muted-foreground truncate">{p.email} · Last active {lastActive(p)}</div>
				</div>
				<div class="flex items-center gap-1.5 shrink-0">
					<Button variant="outline" size="sm" onclick={() => (editing = p)}>
						<PencilIcon class="size-3.5" />
						Edit
					</Button>
					{#if p.id !== data.meId && p.totpEnabled}
						<Button variant="outline" size="sm" onclick={() => (confirm = { kind: 'totp', person: p })}>Reset 2FA</Button>
					{/if}
					{#if !p.isOwner}
						{#if p.isActive}
							<Button variant="outline" size="sm" class="text-destructive hover:text-destructive" onclick={() => (confirm = { kind: 'disable', person: p })}>Disable</Button>
						{:else}
							<form method="POST" action="?/setActive" use:enhance={submit}>
								<input type="hidden" name="id" value={p.id} />
								<input type="hidden" name="active" value="true" />
								<Button type="submit" variant="outline" size="sm" disabled={busy}>Enable</Button>
							</form>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Add person -->
<Dialog.Root bind:open={addOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add person</Dialog.Title>
			<Dialog.Description>They sign in with this email and password, then set up 2FA on their phone.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/create" use:enhance={submit} class="space-y-3">
			<div class="space-y-1.5">
				<Label for="add-name">Name</Label>
				<Input id="add-name" name="name" required minlength={2} autocomplete="off" />
			</div>
			<div class="space-y-1.5">
				<Label for="add-email">Email</Label>
				<Input id="add-email" name="email" type="email" required autocomplete="off" />
			</div>
			<div class="space-y-1.5">
				<Label for="add-password">Password</Label>
				<Input id="add-password" name="password" type="password" required minlength={10} placeholder="At least 10 characters" autocomplete="new-password" />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (addOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={busy}>
					{#if busy}<Loader2Icon class="size-4 animate-spin" />{/if}
					Add person
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit -->
<Dialog.Root open={!!editing} onOpenChange={(open) => { if (!open) editing = null; }}>
	<Dialog.Content class="sm:max-w-md">
		{#if editing}
			<Dialog.Header>
				<Dialog.Title>Edit {editing.name}</Dialog.Title>
			</Dialog.Header>
			<form method="POST" action="?/update" use:enhance={submit} class="space-y-3">
				<input type="hidden" name="id" value={editing.id} />
				<div class="space-y-1.5">
					<Label for="edit-name">Name</Label>
					<Input id="edit-name" name="name" value={editing.name} required minlength={2} />
				</div>
				<div class="space-y-1.5">
					<Label for="edit-email">Email</Label>
					<Input id="edit-email" name="email" type="email" value={editing.email} required />
				</div>
				<div class="space-y-1.5">
					<Label for="edit-password">New password</Label>
					<Input id="edit-password" name="password" type="password" minlength={10} placeholder="Leave blank to keep the current one" autocomplete="new-password" />
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (editing = null)}>Cancel</Button>
					<Button type="submit" disabled={busy}>
						{#if busy}<Loader2Icon class="size-4 animate-spin" />{/if}
						Save
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Disable / reset 2FA confirmation -->
<Dialog.Root open={!!confirm} onOpenChange={(open) => { if (!open) confirm = null; }}>
	<Dialog.Content class="sm:max-w-sm">
		{#if confirm}
			<Dialog.Header>
				<Dialog.Title>{confirm.kind === 'disable' ? `Disable ${confirm.person.name}?` : `Reset 2FA for ${confirm.person.name}?`}</Dialog.Title>
				<Dialog.Description>
					{#if confirm.kind === 'disable'}
						They're signed out everywhere and can't sign in until you enable the account again. Their history stays.
					{:else}
						Use this when they lose or replace their phone. They're signed out everywhere and set up 2FA again at next sign-in.
					{/if}
				</Dialog.Description>
			</Dialog.Header>
			<form method="POST" action={confirm.kind === 'disable' ? '?/setActive' : '?/resetTotp'} use:enhance={submit}>
				<input type="hidden" name="id" value={confirm.person.id} />
				{#if confirm.kind === 'disable'}<input type="hidden" name="active" value="false" />{/if}
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (confirm = null)}>Cancel</Button>
					<Button type="submit" variant="destructive" disabled={busy}>
						{#if busy}<Loader2Icon class="size-4 animate-spin" />{/if}
						{confirm.kind === 'disable' ? 'Disable' : 'Reset 2FA'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
