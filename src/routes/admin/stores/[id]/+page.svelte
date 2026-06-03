<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let confirmDelete = $state(false);
</script>

<svelte:head>
	<title>Edit Store — {data.store.nickname}</title>
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
					<label class="label" for="nickname">Nickname</label>
					<input id="nickname" name="nickname" class="input" value={data.store.nickname} required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="name">Official Name</label>
					<input id="name" name="name" class="input" value={data.store.name} required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="shopifyDomain">Shopify Domain</label>
					<input id="shopifyDomain" name="shopifyDomain" class="input font-mono" value={data.store.shopifyDomain} required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="apiAccessToken">API Access Token</label>
					<input id="apiAccessToken" name="apiAccessToken" type="password" class="input font-mono" placeholder="Leave blank to keep current token" />
				</div>
				<div class="flex items-center gap-3 pt-2">
					<button type="submit" class="btn-primary">Save Changes</button>
					<a href="/admin/stores" class="btn-secondary">Cancel</a>
				</div>
			</form>
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
