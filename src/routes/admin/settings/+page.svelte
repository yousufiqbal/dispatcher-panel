<script lang="ts">
	import { enhance } from '$app/forms';
	import { SHOPIFY_SCOPES, SHOPIFY_SCOPE_STRING } from '$lib/shopify-scopes';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let copied = $state(false);

	async function copyScopes() {
		await navigator.clipboard.writeText(SHOPIFY_SCOPE_STRING);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	let postexEnabled = $state(data.couriers.postex.enabled);
	let dexEnabled = $state(data.couriers.dex.enabled);

	let activeTab = $state<'account' | 'scopes' | 'integrations'>('account');
</script>

{#snippet courierForm(code: 'postex' | 'dex', label: string, enabled: boolean, courier: typeof data.couriers.postex)}
	<form method="POST" action="?/saveCourier" use:enhance class="space-y-4">
		<input type="hidden" name="courier" value={code} />
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-semibold">{label}</h3>
				{#if courier.hasApiKey}<p class="text-xs text-muted-foreground">API key saved</p>{/if}
			</div>
			<label class="flex items-center gap-2 cursor-pointer text-sm">
				<input
					type="checkbox"
					name="enabled"
					value="true"
					checked={enabled}
					onchange={(e) => { if (code === 'postex') postexEnabled = e.currentTarget.checked; else dexEnabled = e.currentTarget.checked; }}
					class="rounded border-border"
				/>
				Enabled
			</label>
		</div>
		<div class="space-y-1.5">
			<label class="label text-xs" for="{code}-apiKey">API Key</label>
			<input id="{code}-apiKey" name="apiKey" type="password" class="input" placeholder={courier.hasApiKey ? 'Leave blank to keep current key' : 'API key'} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<label class="label text-xs" for="{code}-weight">Default Weight (g)</label>
				<input id="{code}-weight" name="defaultWeight" class="input" value={courier.defaultWeight} placeholder="500" />
			</div>
			<label class="flex items-center gap-2 cursor-pointer text-sm self-end pb-2">
				<input type="checkbox" name="defaultFragile" value="true" checked={courier.defaultFragile} class="rounded border-border" />
				Fragile by default
			</label>
		</div>
		<div class="space-y-1.5">
			<label class="label text-xs" for="{code}-note">Default Note</label>
			<input id="{code}-note" name="defaultNote" class="input" value={courier.defaultNote} placeholder="Optional note added to every booking" />
		</div>
		<button type="submit" class="btn-secondary btn-sm">Save {label} Settings</button>
	</form>
{/snippet}

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
		<button
			onclick={() => activeTab = 'integrations'}
			class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150
				{activeTab === 'integrations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			Integrations
		</button>
	</div>

	{#if activeTab === 'account'}
		<!-- Email -->
		<a href="/admin/settings/email" class="card block hover:bg-muted/30 transition-colors">
			<div class="card-content pt-6 flex items-center justify-between">
				<div>
					<h2 class="text-base font-semibold">Email Address</h2>
					<p class="text-sm text-muted-foreground">Current: <strong>{data.email}</strong></p>
				</div>
				<svg class="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</a>

		<!-- Password -->
		<a href="/admin/settings/password" class="card block hover:bg-muted/30 transition-colors">
			<div class="card-content pt-6 flex items-center justify-between">
				<div>
					<h2 class="text-base font-semibold">Password</h2>
					<p class="text-sm text-muted-foreground">Change your account password</p>
				</div>
				<svg class="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</a>

		<!-- Activity Log -->
		<a href="/admin/settings/activity-log" class="card block hover:bg-muted/30 transition-colors">
			<div class="card-content pt-6 flex items-center justify-between">
				<div>
					<h2 class="text-base font-semibold">Activity Log</h2>
					<p class="text-sm text-muted-foreground">Choose which dispatcher activities get recorded</p>
				</div>
				<svg class="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</a>

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
	{:else}
		<!-- PostEx -->
		<div class="card">
			<div class="card-header">
				<h2 class="text-base font-semibold">PostEx</h2>
				<p class="text-sm text-muted-foreground">Enable and set booking defaults for PostEx.</p>
			</div>
			<div class="card-content">
				{@render courierForm('postex', 'PostEx', postexEnabled, data.couriers.postex)}
			</div>
		</div>

		<!-- DEX -->
		<div class="card">
			<div class="card-header">
				<h2 class="text-base font-semibold">DEX</h2>
				<p class="text-sm text-muted-foreground">Enable and set booking defaults for DEX.</p>
			</div>
			<div class="card-content">
				{@render courierForm('dex', 'DEX', dexEnabled, data.couriers.dex)}
			</div>
		</div>
	{/if}
</div>
