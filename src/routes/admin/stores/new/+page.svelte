<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let testing = $state(false);
	let testResult = $state<'success' | 'fail' | null>(null);
	let testDomain = $state('');
	let testToken = $state('');

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

<div class="p-8 max-w-2xl">
	<div class="mb-6">
		<a href="/admin/stores" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Stores
		</a>
		<h1 class="text-2xl font-bold">Add Store</h1>
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
			<form method="POST" use:enhance class="space-y-5">
				<div class="space-y-1.5">
					<label class="label" for="nickname">Nickname <span class="text-destructive">*</span></label>
					<input id="nickname" name="nickname" class="input" placeholder="Main Store" value={form?.values?.nickname ?? ''} required />
					<p class="text-xs text-muted-foreground">Shown to dispatchers in the sidebar</p>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="name">Official Store Name <span class="text-destructive">*</span></label>
					<input id="name" name="name" class="input" placeholder="My Shopify Store" value={form?.values?.name ?? ''} required />
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

				<div class="flex items-center gap-3 pt-2">
					<button type="submit" class="btn-primary">Save Store</button>
					<a href="/admin/stores" class="btn-secondary">Cancel</a>
				</div>
			</form>
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
				<li>Give it a name (e.g. "Dispatcher Panel")</li>
				<li>Go to <strong>Configuration</strong> → enable these API scopes:
					<code class="text-xs bg-muted px-1 py-0.5 rounded">read_orders, write_orders, read_customers, write_customers, read_draft_orders, write_draft_orders, read_fulfillments, write_fulfillments</code>
				</li>
				<li>Click <strong>Install app</strong> → copy the <strong>Admin API access token</strong></li>
			</ol>
		</div>
	</div>
</div>
