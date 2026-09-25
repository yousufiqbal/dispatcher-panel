<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDateShort } from '$lib/utils';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import AvatarInitial from '$lib/components/AvatarInitial.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirmReset = $state(false);
	let resetting = $state(false);
</script>

<svelte:head>
	<title>{data.dispatcher.name} — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack href="/admin/dispatchers" backTitle="Back to Dispatchers" title={data.dispatcher.name}>
		{#snippet leading()}
			<AvatarInitial name={data.dispatcher.name} />
		{/snippet}
		{#snippet meta()}
			{#if data.dispatcher.isActive}
				<span class="badge badge-fulfilled">Active</span>
			{:else}
				<span class="badge badge-cancelled">Disabled</span>
			{/if}
			<p class="text-sm text-muted-foreground">{data.dispatcher.email}</p>
		{/snippet}
	</PageHeaderBack>

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

	<!-- Two-factor authentication -->
	<div class="card mb-4">
		<div class="card-header">
			<h2 class="text-sm font-semibold">Two-Factor Authentication</h2>
		</div>
		<div class="card-content space-y-3">
			{#if form?.reset}
				<div class="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
					2FA reset. They'll set up a new authenticator on their next sign-in.
				</div>
			{:else if form?.error}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{form.error}</div>
			{/if}

			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-2.5 min-w-0">
					{#if data.dispatcher.totpEnabled}
						<ShieldCheckIcon class="size-5 text-green-600 shrink-0" />
						<div class="min-w-0">
							<div class="text-sm font-medium text-foreground">Enabled</div>
							<div class="text-xs text-muted-foreground">Authenticator app is set up</div>
						</div>
					{:else}
						<ShieldAlertIcon class="size-5 text-amber-600 shrink-0" />
						<div class="min-w-0">
							<div class="text-sm font-medium text-foreground">Not set up</div>
							<div class="text-xs text-muted-foreground">Required — they'll enrol on next sign-in</div>
						</div>
					{/if}
				</div>
				{#if data.dispatcher.totpEnabled}
					<Button variant="outline" size="sm" class="shrink-0" onclick={() => confirmReset = true}>Reset</Button>
				{/if}
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
		<ChevronRightIcon class="size-5 text-muted-foreground shrink-0" />
	</a>

	<Button href="/admin/dispatchers/{data.dispatcher.id}/edit">
		<PencilIcon class="size-4" />
		Edit Dispatcher
	</Button>
</div>

<Dialog.Root bind:open={confirmReset}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Reset two-factor authentication?</Dialog.Title>
			<Dialog.Description>
				Use this when {data.dispatcher.name} has lost access to their authenticator app.
			</Dialog.Description>
		</Dialog.Header>
		<ul class="text-sm text-muted-foreground list-disc pl-5 space-y-1">
			<li>Their current authenticator entry stops working</li>
			<li>Every remembered device and active session is signed out</li>
			<li>They must set up a new authenticator on their next sign-in</li>
		</ul>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => confirmReset = false}>Cancel</Button>
			<form
				method="POST"
				action="?/resetTotp"
				use:enhance={() => {
					resetting = true;
					return async ({ update }) => {
						await update();
						resetting = false;
						confirmReset = false;
					};
				}}
			>
				<Button type="submit" variant="destructive" disabled={resetting}>
					{resetting ? 'Resetting…' : 'Reset 2FA'}
				</Button>
			</form>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
