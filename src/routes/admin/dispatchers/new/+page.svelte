<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selectedStores = $state<string[]>(form?.values?.storeIds ?? []);

	function toggleStore(id: string) {
		if (selectedStores.includes(id)) {
			selectedStores = selectedStores.filter((s) => s !== id);
		} else {
			selectedStores = [...selectedStores, id];
		}
	}
</script>

<svelte:head>
	<title>Add Dispatcher — Admin</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack
		href="/admin/dispatchers"
		backTitle="Back to Dispatchers"
		title="Add Dispatcher"
		subtitle="Create a new dispatcher account and assign store access"
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
						<Label for="name">Full Name <span class="text-destructive">*</span></Label>
						<Input id="name" name="name" placeholder="Jane Smith" value={form?.values?.name ?? ''} required />
					</div>
					<div class="space-y-1.5">
						<Label for="email">Email <span class="text-destructive">*</span></Label>
						<Input id="email" name="email" type="email" placeholder="jane@example.com" value={form?.values?.email ?? ''} required />
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="password">Password <span class="text-destructive">*</span></Label>
					<Input id="password" name="password" type="password" placeholder="Minimum 10 characters" minlength={10} required />
				</div>

				<!-- Store assignment -->
				<div class="space-y-2">
					<Label>Store Access</Label>
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
					<Button type="submit">Create Dispatcher</Button>
					<Button href="/admin/dispatchers" variant="secondary">Cancel</Button>
				</div>
			</form>
		</div>
	</div>
</div>
