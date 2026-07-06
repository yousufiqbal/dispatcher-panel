<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selectedStores = $state<string[]>(form?.values?.storeIds ?? []);
	let enabled = $state(form?.values?.enabled ?? true);
	let defaultFragile = $state(form?.values?.defaultFragile ?? false);

	function toggleStore(id: string) {
		if (selectedStores.includes(id)) {
			selectedStores = selectedStores.filter((s) => s !== id);
		} else {
			selectedStores = [...selectedStores, id];
		}
	}
</script>

<svelte:head>
	<title>Add Courier — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/couriers" class="btn-secondary btn-icon shrink-0" title="Back to Couriers">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Add Courier</h1>
		</div>
		<p class="text-sm text-muted-foreground mt-1">Add a courier account and assign it to stores</p>
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
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<label class="label" for="name">Courier Name <span class="text-destructive">*</span></label>
						<input id="name" name="name" class="input" placeholder="PostEx — Main Warehouse" value={form?.values?.name ?? ''} required />
					</div>
					<div class="space-y-1.5">
						<label class="label" for="provider">Provider <span class="text-destructive">*</span></label>
						<select id="provider" name="provider" class="input" value={form?.values?.provider ?? 'postex'} required>
							<option value="postex">PostEx</option>
							<option value="dex">DEX</option>
						</select>
					</div>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="apiKey">API Key</label>
					<input id="apiKey" name="apiKey" type="password" class="input" placeholder="API key" />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<label class="label text-xs" for="defaultWeight">Default Weight (g)</label>
						<input id="defaultWeight" name="defaultWeight" class="input" placeholder="500" value={form?.values?.defaultWeight ?? ''} />
					</div>
					<label class="flex items-center gap-2 cursor-pointer text-sm self-end pb-2">
						<input type="checkbox" name="defaultFragile" value="true" bind:checked={defaultFragile} class="rounded border-border" />
						Fragile by default
					</label>
				</div>

				<div class="space-y-1.5">
					<label class="label text-xs" for="defaultNote">Default Note</label>
					<input id="defaultNote" name="defaultNote" class="input" placeholder="Optional note added to every booking" value={form?.values?.defaultNote ?? ''} />
				</div>

				<label class="flex items-center gap-2 cursor-pointer text-sm">
					<input type="checkbox" name="enabled" value="true" bind:checked={enabled} class="rounded border-border" />
					Enabled
				</label>

				<!-- Store assignment -->
				<div class="space-y-2">
					<label class="label">Assign to Stores</label>
					{#if data.stores.length === 0}
						<p class="text-sm text-muted-foreground">No active stores available. <a href="/admin/stores/new" class="underline">Add a store first.</a></p>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							{#each data.stores as store}
								<label class="flex items-center gap-3 border border-border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors {selectedStores.includes(store.id) ? 'border-primary/50 bg-primary/5' : ''}">
									<input
										type="checkbox"
										name="storeIds"
										value={store.id}
										checked={selectedStores.includes(store.id)}
										onchange={() => toggleStore(store.id)}
										class="rounded border-border text-primary"
									/>
									<div class="text-sm font-medium text-foreground">{store.name}</div>
								</label>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex items-center gap-3 pt-2">
					<button type="submit" class="btn-primary">Create Courier</button>
					<a href="/admin/couriers" class="btn-secondary">Cancel</a>
				</div>
			</form>
		</div>
	</div>
</div>
