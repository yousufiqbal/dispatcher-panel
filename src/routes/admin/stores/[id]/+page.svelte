<script lang="ts">
	import { enhance } from '$app/forms';
	import ShopifyOAuthExchange from '$lib/components/ShopifyOAuthExchange.svelte';
	import { SHOPIFY_SCOPE_STRING } from '$lib/shopify-scopes';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let confirmDelete = $state(false);

	let apiAccessToken = $state('');
	let oauthClientId = $state(data.store.oauthClientId ?? '');
	let oauthRedirectUri = $state(data.store.oauthRedirectUri ?? '');
	const scope = SHOPIFY_SCOPE_STRING;
</script>

<svelte:head>
	<title>Edit Store — {data.store.name}</title>
</svelte:head>

<div class="p-8 max-w-2xl">
	<div class="mb-6">
		<a href="/admin/stores" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Stores
		</a>
		<h1 class="text-2xl font-bold">Edit Store</h1>
		<p class="text-sm text-muted-foreground mt-1">{data.store.shopifyDomain}</p>
	</div>

	{#if form?.errors}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
			<ul class="list-disc list-inside space-y-1">
				{#each form.errors as err}<li>{err}</li>{/each}
			</ul>
		</div>
	{/if}

	<div class="card mb-6">
		<div class="card-content pt-6">
			<form method="POST" action="?/update" use:enhance class="space-y-5">
				<div class="space-y-1.5">
					<label class="label" for="name">Store Name</label>
					<input id="name" name="name" class="input" value={data.store.name} required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="shopifyDomain">Shopify Domain</label>
					<input id="shopifyDomain" name="shopifyDomain" class="input font-mono" value={data.store.shopifyDomain} required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="apiAccessToken">API Access Token</label>
					<input
						id="apiAccessToken"
						name="apiAccessToken"
						type="password"
						class="input font-mono"
						placeholder="Leave blank to keep current token"
						bind:value={apiAccessToken}
					/>
				</div>
				<div class="flex items-center gap-3 pt-2">
					<button type="submit" class="btn-primary">Save Changes</button>
					<a href="/admin/stores" class="btn-secondary">Cancel</a>
				</div>
			</form>
		</div>
	</div>

	<!-- OAuth app -->
	<div class="card mb-6">
		<div class="card-header">
			<h2 class="text-sm font-semibold">OAuth App</h2>
			<p class="text-xs text-muted-foreground mt-1">
				Used to refresh the Admin API token without copy-pasting from Shopify manually
			</p>
		</div>
		<div class="card-content space-y-5">
			<form method="POST" action="?/update" use:enhance class="space-y-5">
				<input type="hidden" name="name" value={data.store.name} />
				<input type="hidden" name="shopifyDomain" value={data.store.shopifyDomain} />
				<input type="hidden" name="apiAccessToken" value="" />
				<div class="space-y-1.5">
					<label class="label" for="oauthClientId">Client ID</label>
					<input id="oauthClientId" name="oauthClientId" class="input font-mono" bind:value={oauthClientId} />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="oauthClientSecret">Client Secret</label>
					<input
						id="oauthClientSecret"
						name="oauthClientSecret"
						type="password"
						class="input font-mono"
						placeholder="Leave blank to keep current secret"
					/>
				</div>
				<div class="space-y-1.5">
					<label class="label" for="oauthRedirectUri">Redirect URI</label>
					<input id="oauthRedirectUri" name="oauthRedirectUri" class="input font-mono" bind:value={oauthRedirectUri} />
				</div>
				<button type="submit" class="btn-secondary btn-sm">Save OAuth App</button>
			</form>

			{#if oauthClientId && oauthRedirectUri}
				<ShopifyOAuthExchange
					shopifyDomain={data.store.shopifyDomain}
					clientId={oauthClientId}
					redirectUri={oauthRedirectUri}
					{scope}
					exchange={async (code) => {
						const res = await fetch(`/api/admin/stores/${data.store.id}/oauth-token`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ code })
						});
						if (!res.ok) throw new Error('Token exchange failed');
						const body = await res.json();
						return body.accessToken;
					}}
					onToken={(token) => (apiAccessToken = token)}
				/>
				{#if apiAccessToken}
					<p class="text-xs text-green-700">
						Token retrieved — click <strong>Save Changes</strong> above to store it.
					</p>
				{/if}
			{:else}
				<p class="text-xs text-muted-foreground">Set Client ID and Redirect URI, then save, to enable one-click token refresh.</p>
			{/if}
		</div>
	</div>

	<!-- Danger zone -->
	<div class="card border-destructive/30">
		<div class="card-header">
			<h2 class="text-sm font-semibold text-destructive">Danger Zone</h2>
		</div>
		<div class="card-content flex items-center justify-between">
			<div>
				<div class="text-sm font-medium">Delete this store</div>
				<div class="text-xs text-muted-foreground">This will revoke access for all dispatchers assigned to it.</div>
			</div>
			{#if confirmDelete}
				<form method="POST" action="?/delete" use:enhance class="flex gap-2">
					<button type="submit" class="btn-destructive btn-sm">Confirm Delete</button>
					<button type="button" class="btn-secondary btn-sm" onclick={() => confirmDelete = false}>Cancel</button>
				</form>
			{:else}
				<button class="btn-destructive btn-sm" onclick={() => confirmDelete = true}>Delete</button>
			{/if}
		</div>
	</div>
</div>
