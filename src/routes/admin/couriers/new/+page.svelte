<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selectedStores = $state<string[]>(form?.values?.storeIds ?? []);
	let enabled = $state(form?.values?.enabled ?? true);
	let defaultFragile = $state(form?.values?.defaultFragile ?? false);
	let provider = $state(form?.values?.provider ?? 'postex');

	const providerLabels: Record<string, string> = { postex: 'PostEx', dex: 'DEX' };

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
	<PageHeaderBack
		href="/admin/couriers"
		backTitle="Back to Couriers"
		title="Add Courier"
		subtitle="Add a courier account and assign it to stores"
	/>

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
						<Label for="name">Courier Name <span class="text-destructive">*</span></Label>
						<Input id="name" name="name" placeholder="PostEx — Main Warehouse" value={form?.values?.name ?? ''} required />
					</div>
					<div class="space-y-1.5">
						<Label for="provider">Provider <span class="text-destructive">*</span></Label>
						<input type="hidden" name="provider" value={provider} />
						<Select.Root type="single" bind:value={provider}>
							<Select.Trigger id="provider" class="w-full">
								{providerLabels[provider]}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="postex" label="PostEx">PostEx</Select.Item>
								<Select.Item value="dex" label="DEX">DEX</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="apiKey">API Key</Label>
					<Input id="apiKey" name="apiKey" type="password" placeholder="API key" />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label class="text-xs" for="defaultWeight">Default Weight (g)</Label>
						<Input id="defaultWeight" name="defaultWeight" placeholder="500" value={form?.values?.defaultWeight ?? ''} />
					</div>
					<label class="flex items-center gap-2 cursor-pointer text-sm self-end pb-2">
						<Checkbox name="defaultFragile" value="true" bind:checked={defaultFragile} />
						Fragile by default
					</label>
				</div>

				<div class="space-y-1.5">
					<Label class="text-xs" for="defaultNote">Default Note</Label>
					<Input id="defaultNote" name="defaultNote" placeholder="Optional note added to every booking" value={form?.values?.defaultNote ?? ''} />
				</div>

				<label class="flex items-center gap-2 cursor-pointer text-sm">
					<Checkbox name="enabled" value="true" bind:checked={enabled} />
					Enabled
				</label>

				<!-- Store assignment -->
				<div class="space-y-2">
					<Label>Assign to Stores</Label>
					{#if data.stores.length === 0}
						<p class="text-sm text-muted-foreground">No active stores available. <a href="/admin/stores/new" class="underline">Add a store first.</a></p>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							{#each data.stores as store}
								<label class="flex items-center gap-3 border border-border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors {selectedStores.includes(store.id) ? 'border-primary/50 bg-primary/5' : ''}">
									<Checkbox
										name="storeIds"
										value={store.id}
										checked={selectedStores.includes(store.id)}
										onCheckedChange={() => toggleStore(store.id)}
									/>
									<div class="text-sm font-medium text-foreground">{store.name}</div>
								</label>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex items-center gap-3 pt-2">
					<Button type="submit">Create Courier</Button>
					<Button href="/admin/couriers" variant="secondary">Cancel</Button>
				</div>
			</form>
		</div>
	</div>
</div>
