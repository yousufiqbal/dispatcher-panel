<script lang="ts">
	import { enhance } from '$app/forms';
	import { SHOPIFY_SCOPES, SHOPIFY_SCOPE_STRING } from '$lib/shopify-scopes';
	import { openLogoutConfirm } from '$lib/adminLogoutConfirm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let copied = $state(false);

	async function copyScopes() {
		await navigator.clipboard.writeText(SHOPIFY_SCOPE_STRING);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	let activeTab = $state<'account' | 'scopes'>('account');
</script>

<svelte:head>
	<title>Settings — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Settings</h1>
		<p class="text-sm text-muted-foreground mt-1">Manage admin account and store integrations</p>
	</div>

	<!-- Tabs -->
	<div class="flex items-center gap-1 border-b border-border -mt-2">
		<button
			onclick={() => activeTab = 'account'}
			class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150
				{activeTab === 'account' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			Account
		</button>
		<button
			onclick={() => activeTab = 'scopes'}
			class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150
				{activeTab === 'scopes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			Scopes
		</button>
	</div>

	{#if activeTab === 'account'}
		<!-- Grouped nav rows -->
		<div class="card overflow-hidden">
			<div class="divide-y divide-border">
				<a href="/admin/settings/email" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
					<div>
						<h2 class="text-base font-semibold">Email Address</h2>
						<p class="text-sm text-muted-foreground">Current: <strong>{data.email}</strong></p>
					</div>
					<svg class="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</a>

				<a href="/admin/settings/password" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
					<div>
						<h2 class="text-base font-semibold">Password</h2>
						<p class="text-sm text-muted-foreground">Change your account password</p>
					</div>
					<svg class="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</a>

				<a href="/admin/settings/activity-log" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
					<div>
						<h2 class="text-base font-semibold">Activity Log</h2>
						<p class="text-sm text-muted-foreground">Choose which dispatcher activities get recorded</p>
					</div>
					<svg class="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</a>

				<a href="/admin/couriers" class="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
					<div>
						<h2 class="text-base font-semibold">Couriers</h2>
						<p class="text-sm text-muted-foreground">Manage courier accounts and which stores can use them</p>
					</div>
					<svg class="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</a>

				<button
					onclick={() => openLogoutConfirm()}
					class="lg:hidden w-full flex items-center justify-between px-6 py-4 hover:bg-destructive/5 transition-colors text-left"
				>
					<span class="text-base font-semibold text-destructive">Sign Out</span>
					<svg class="size-4 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
				</button>
			</div>
		</div>

		<!-- 2FA -->
		<div class="card">
			<div class="card-header">
				<h2 class="text-base font-semibold">Two-Factor Authentication</h2>
				<p class="text-sm text-muted-foreground">
					Status: {#if data.totpEnabled}<span class="text-green-700 font-medium">Enabled</span>{:else}<span class="text-destructive font-medium">Disabled</span>{/if}
				</p>
			</div>
			<div class="card-content">
				{#if form?.totpDisabled}
					<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">2FA disabled. You will be prompted to set it up on next login.</div>
				{/if}
				{#if data.totpEnabled}
					<p class="text-sm text-muted-foreground mb-4">Disabling 2FA will require you to set it up again on next login.</p>
					<form method="POST" action="?/disableTotp" use:enhance>
						<button type="submit" class="btn-destructive">Disable 2FA</button>
					</form>
				{:else}
					<p class="text-sm text-muted-foreground">2FA is not active. Log out and log back in to trigger setup.</p>
				{/if}
			</div>
		</div>
	{:else if activeTab === 'scopes'}
		<!-- Shopify Scopes -->
		<div class="card">
			<div class="card-header">
				<h2 class="text-base font-semibold">Required Shopify Scopes</h2>
				<p class="text-sm text-muted-foreground">
					Enable these Admin API scopes on your Shopify custom app, then install/reinstall to get a token.
				</p>
			</div>
			<div class="card-content space-y-4">
				<div class="flex items-center gap-2">
					<code class="input font-mono text-xs flex-1 overflow-x-auto whitespace-nowrap py-2.5">{SHOPIFY_SCOPE_STRING}</code>
					<button type="button" class="btn-secondary btn-sm shrink-0" onclick={copyScopes}>
						{copied ? 'Copied!' : 'Copy'}
					</button>
				</div>
				<div class="rounded-md border border-border divide-y divide-border">
					{#each SHOPIFY_SCOPES as s (s.scope)}
						<div class="px-4 py-3">
							<code class="text-sm font-mono font-semibold">{s.scope}</code>
							<p class="text-xs text-muted-foreground mt-0.5">{s.why}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
