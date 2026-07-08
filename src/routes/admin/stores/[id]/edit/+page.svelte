<script lang="ts">
	import { enhance } from '$app/forms';
	import ShopifyOAuthExchange from '$lib/components/ShopifyOAuthExchange.svelte';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import DangerZoneCard from '$lib/components/DangerZoneCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let apiAccessToken = $state('');
	let oauthClientId = $state(data.store.oauthClientId ?? '');
	let oauthRedirectUri = $state(data.store.oauthRedirectUri ?? '');

	let iconPreview = $state<string | null>(data.store.iconUrl ?? null);
	let oauthFormEl: HTMLFormElement;

	async function saveOAuthApp() {
		const fd = new FormData(oauthFormEl);
		const res = await fetch(oauthFormEl.action, { method: 'POST', body: fd });
		if (!res.ok) throw new Error('Failed to save OAuth app settings');
	}

	function onIconChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => (iconPreview = reader.result as string);
		reader.readAsDataURL(file);
	}
</script>

<svelte:head>
	<title>Edit Store — {data.store.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack
		href="/admin/stores/{data.store.id}"
		backTitle="Back to {data.store.name}"
		title="Edit Store"
		subtitle={data.store.shopifyDomain}
	/>

	{#if form?.errors}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
			<ul class="list-disc list-inside space-y-1">
				{#each form.errors as err}<li>{err}</li>{/each}
			</ul>
		</div>
	{/if}

	<div class="card mb-6">
		<div class="card-content pt-6">
			<form method="POST" action="?/update" use:enhance enctype="multipart/form-data" class="space-y-5">
				<div class="space-y-1.5">
					<Label for="name">Store Name</Label>
					<Input id="name" name="name" value={data.store.name} required />
				</div>
				<div class="space-y-1.5">
					<Label for="icon">Store Icon</Label>
					<div class="flex items-center gap-3">
						{#if iconPreview}
							<img src={iconPreview} alt="" class="size-10 rounded-lg object-contain border border-border shrink-0" />
						{:else}
							<div class="size-10 rounded-lg bg-muted border border-border shrink-0"></div>
						{/if}
						<Input id="icon" name="icon" type="file" accept="image/*" onchange={onIconChange} />
					</div>
					<p class="text-xs text-muted-foreground">Leave blank to keep the current icon</p>
				</div>
				<div class="space-y-1.5">
					<Label for="shopifyDomain">Shopify Domain</Label>
					<Input id="shopifyDomain" name="shopifyDomain" class="font-mono" value={data.store.shopifyDomain} required />
				</div>
				<div class="space-y-1.5">
					<Label for="apiAccessToken">API Access Token</Label>
					<Input
						id="apiAccessToken"
						name="apiAccessToken"
						type="password"
						autocomplete="new-password"
						class="font-mono"
						placeholder="Leave blank to keep current token"
						bind:value={apiAccessToken}
					/>
				</div>
				<div class="flex items-center gap-3 pt-2">
					<Button type="submit">Save Changes</Button>
					<Button href="/admin/stores/{data.store.id}" variant="secondary">Cancel</Button>
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
			<form method="POST" action="?/update" use:enhance bind:this={oauthFormEl} class="space-y-5">
				<input type="hidden" name="name" value={data.store.name} />
				<input type="hidden" name="shopifyDomain" value={data.store.shopifyDomain} />
				<input type="hidden" name="apiAccessToken" value="" />
				<div class="space-y-1.5">
					<Label for="oauthClientId">Client ID</Label>
					<Input id="oauthClientId" name="oauthClientId" class="font-mono" autocomplete="off" bind:value={oauthClientId} />
				</div>
				<div class="space-y-1.5">
					<Label for="oauthClientSecret">Client Secret</Label>
					<Input
						id="oauthClientSecret"
						name="oauthClientSecret"
						type="password"
						autocomplete="new-password"
						class="font-mono"
						placeholder="Leave blank to keep current secret"
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="oauthRedirectUri">Redirect URI</Label>
					<Input id="oauthRedirectUri" name="oauthRedirectUri" class="font-mono" autocomplete="off" bind:value={oauthRedirectUri} />
				</div>
				<Button type="submit" variant="secondary" size="sm">Save OAuth App</Button>
			</form>

			{#if oauthClientId && oauthRedirectUri}
				<ShopifyOAuthExchange
					shopifyDomain={data.store.shopifyDomain}
					clientId={oauthClientId}
					redirectUri={oauthRedirectUri}
					exchange={async (code) => {
						const res = await fetch(`/api/admin/stores/${data.store.id}/oauth-token`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ code })
						});
						if (!res.ok) {
							const body = await res.json().catch(() => null);
							throw new Error(body?.message ?? 'Token exchange failed');
						}
						const body = await res.json();
						return body.accessToken;
					}}
					onToken={(token) => (apiAccessToken = token)}
					beforeAuthorize={saveOAuthApp}
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

	<DangerZoneCard
		itemLabel="this store"
		description="This will revoke access for all dispatchers assigned to it. This cannot be undone."
	/>
</div>
