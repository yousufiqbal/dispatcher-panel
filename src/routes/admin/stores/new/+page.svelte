<script lang="ts">
	import { enhance } from '$app/forms';
	import ShopifyOAuthExchange from '$lib/components/ShopifyOAuthExchange.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let testing = $state(false);
	let testResult = $state<'success' | 'fail' | null>(null);
	let testDomain = $state('');
	let testToken = $state('');

	let oauthClientId = $state('');
	let oauthClientSecret = $state('');
	let oauthRedirectUri = $state('');

	let iconPreview = $state<string | null>(null);

	function onIconChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) {
			iconPreview = null;
			return;
		}
		const reader = new FileReader();
		reader.onload = () => (iconPreview = reader.result as string);
		reader.readAsDataURL(file);
	}

	async function testConnection() {
		testing = true;
		testResult = null;
		try {
			const res = await fetch('/api/shopify/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: testDomain, token: testToken })
			});
			testResult = res.ok ? 'success' : 'fail';
		} catch {
			testResult = 'fail';
		} finally {
			testing = false;
		}
	}
</script>

<svelte:head>
	<title>Add Store — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/stores" class="btn-secondary btn-icon shrink-0" title="Back to Stores">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Add Store</h1>
		</div>
		<p class="text-sm text-muted-foreground mt-1">Connect a Shopify store using its Admin API token</p>
	</div>

	{#if form?.errors}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
			<ul class="list-disc list-inside space-y-1">
				{#each form.errors as err}<li>{err}</li>{/each}
			</ul>
		</div>
	{/if}

	<div class="card">
		<div class="card-content pt-6">
			<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-5">
				<div class="space-y-1.5">
					<label class="label" for="name">Store Name <span class="text-destructive">*</span></label>
					<input id="name" name="name" class="input" placeholder="My Shopify Store" value={form?.values?.name ?? ''} required />
					<p class="text-xs text-muted-foreground">Shown to dispatchers in the sidebar</p>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="icon">Store Icon</label>
					<div class="flex items-center gap-3">
						{#if iconPreview}
							<img src={iconPreview} alt="" class="size-10 rounded-lg object-contain border border-border shrink-0" />
						{:else}
							<div class="size-10 rounded-lg bg-muted border border-border shrink-0"></div>
						{/if}
						<input id="icon" name="icon" type="file" accept="image/*" class="input" onchange={onIconChange} />
					</div>
					<p class="text-xs text-muted-foreground">Shown in the dispatcher sidebar and mobile nav instead of the Shopify logo</p>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="shopifyDomain">Shopify Domain <span class="text-destructive">*</span></label>
					<input
						id="shopifyDomain"
						name="shopifyDomain"
						class="input font-mono"
						placeholder="your-store.myshopify.com"
						required
						bind:value={testDomain}
					/>
					<p class="text-xs text-muted-foreground">Must be the .myshopify.com domain</p>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="apiAccessToken">Admin API Access Token <span class="text-destructive">*</span></label>
					<input
						id="apiAccessToken"
						name="apiAccessToken"
						type="password"
						class="input font-mono"
						placeholder="shpat_..."
						required
						bind:value={testToken}
					/>
					<p class="text-xs text-muted-foreground">
						Found in Shopify Admin → Settings → Apps → Develop apps → your app → API credentials
					</p>
				</div>

				{#if testResult === 'success'}
					<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
						✓ Connection successful
					</div>
				{:else if testResult === 'fail'}
					<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
						✗ Connection failed — check domain and token
					</div>
				{/if}

				<input type="hidden" name="oauthClientId" value={oauthClientId} />
				<input type="hidden" name="oauthClientSecret" value={oauthClientSecret} />
				<input type="hidden" name="oauthRedirectUri" value={oauthRedirectUri} />

				<div class="flex items-center gap-3 pt-2">
					<button type="submit" class="btn-primary">Save Store</button>
					<a href="/admin/stores" class="btn-secondary">Cancel</a>
				</div>
			</form>
		</div>
	</div>

	<!-- OAuth app (optional, lets you refresh the token later without re-pasting it) -->
	<div class="card mt-6">
		<div class="card-header">
			<h2 class="text-sm font-semibold">OAuth App (optional)</h2>
			<p class="text-xs text-muted-foreground mt-1">
				Set this up now to enable one-click token refresh later, instead of manually pasting a token.
			</p>
		</div>
		<div class="card-content space-y-5">
			<div class="space-y-1.5">
				<label class="label" for="oauthClientIdInput">Client ID</label>
				<input id="oauthClientIdInput" class="input font-mono" bind:value={oauthClientId} />
			</div>
			<div class="space-y-1.5">
				<label class="label" for="oauthClientSecretInput">Client Secret</label>
				<input id="oauthClientSecretInput" type="password" class="input font-mono" bind:value={oauthClientSecret} />
			</div>
			<div class="space-y-1.5">
				<label class="label" for="oauthRedirectUriInput">Redirect URI</label>
				<input id="oauthRedirectUriInput" class="input font-mono" bind:value={oauthRedirectUri} />
			</div>

			{#if oauthClientId && oauthClientSecret && oauthRedirectUri && testDomain}
				<ShopifyOAuthExchange
					shopifyDomain={testDomain}
					clientId={oauthClientId}
					redirectUri={oauthRedirectUri}
					exchange={async (code) => {
						const res = await fetch('/api/admin/shopify/oauth-token', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								shopifyDomain: testDomain,
								clientId: oauthClientId,
								clientSecret: oauthClientSecret,
								code
							})
						});
						if (!res.ok) throw new Error('Token exchange failed');
						const body = await res.json();
						return body.accessToken;
					}}
					onToken={(token) => (testToken = token)}
				/>
			{:else}
				<p class="text-xs text-muted-foreground">
					Fill in Shopify Domain above plus Client ID, Client Secret, and Redirect URI here to enable it.
				</p>
			{/if}
		</div>
	</div>

	<!-- How to get a token -->
	<div class="card mt-6">
		<div class="card-header pb-3">
			<h2 class="text-sm font-semibold">How to get an Admin API token</h2>
		</div>
		<div class="card-content">
			<ol class="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
				<li>Go to your Shopify Admin → <strong>Settings</strong> → <strong>Apps and sales channels</strong></li>
				<li>Click <strong>Develop apps</strong> → <strong>Create an app</strong></li>
				<li>Give it a name (e.g. "Pro Shipper")</li>
				<li>Go to <strong>Configuration</strong> → enable the scopes listed on the <a href="/admin/settings" class="underline text-primary">Settings</a> page</li>
				<li>Click <strong>Install app</strong> → copy the <strong>Admin API access token</strong></li>
			</ol>
		</div>
	</div>
</div>
