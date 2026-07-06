<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let enabled = $state(data.courier.enabled);
	let defaultFragile = $state(data.courier.defaultFragile);
	let confirmDelete = $state(false);
</script>

<svelte:head>
	<title>Edit Courier — {data.courier.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/couriers/{data.courier.id}" class="btn-secondary btn-icon shrink-0" title="Back to {data.courier.name}">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Edit Courier</h1>
		</div>
	</div>

	{#if form?.errors}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
			<ul class="list-disc list-inside space-y-1">
				{#each form.errors as err}<li>{err}</li>{/each}
			</ul>
		</div>
	{/if}

	<div class="card mb-4">
		<div class="card-content pt-6">
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					return async ({ update, result }) => {
						await update({ reset: false });
						if (result.type === 'success') addToast('Courier updated');
					};
				}}
				class="space-y-5"
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<label class="label" for="name">Courier Name</label>
						<input id="name" name="name" class="input" value={data.courier.name} required />
					</div>
					<div class="space-y-1.5">
						<label class="label" for="provider">Provider</label>
						<select id="provider" name="provider" class="input" value={data.courier.provider} required>
							<option value="postex">PostEx</option>
							<option value="dex">DEX</option>
						</select>
					</div>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="apiKey">API Key</label>
					<input id="apiKey" name="apiKey" type="password" class="input" placeholder={data.courier.hasApiKey ? 'Leave blank to keep current key' : 'API key'} />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<label class="label text-xs" for="defaultWeight">Default Weight (g)</label>
						<input id="defaultWeight" name="defaultWeight" class="input" value={data.courier.defaultWeight ?? ''} placeholder="500" />
					</div>
					<label class="flex items-center gap-2 cursor-pointer text-sm self-end pb-2">
						<input type="checkbox" name="defaultFragile" value="true" bind:checked={defaultFragile} class="rounded border-border" />
						Fragile by default
					</label>
				</div>

				<div class="space-y-1.5">
					<label class="label text-xs" for="defaultNote">Default Note</label>
					<input id="defaultNote" name="defaultNote" class="input" value={data.courier.defaultNote ?? ''} placeholder="Optional note added to every booking" />
				</div>

				<label class="flex items-center gap-2 cursor-pointer text-sm">
					<input type="checkbox" name="enabled" value="true" bind:checked={enabled} class="rounded border-border" />
					Enabled
				</label>

				<div class="flex items-center gap-3 pt-2">
					<button type="submit" class="btn-primary">Save Changes</button>
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
				<div class="text-sm font-medium">Delete this courier</div>
				<div class="text-xs text-muted-foreground">Cannot be undone. Store assignments removed.</div>
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
