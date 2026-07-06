<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selected = $state<string[]>(data.assignedStoreIds);

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	function selectAll() { selected = data.stores.map((s) => s.id); }
	function clearAll() { selected = []; }
</script>

<svelte:head>
	<title>Assigned Stores — {data.courier.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/couriers/{data.courier.id}" class="btn-secondary btn-icon shrink-0" title="Back to {data.courier.name}">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Assigned Stores</h1>
		</div>
		<p class="text-sm text-muted-foreground mt-1">{data.courier.name}</p>
	</div>

	<form method="POST" action="?/save" use:enhance>
		<div class="card mb-5">
			<div class="card-header pb-3">
				<div class="flex items-center justify-between">
					<h2 class="text-base font-semibold">Assign Stores</h2>
					<div class="flex gap-2">
						<button type="button" onclick={selectAll} class="btn-ghost btn-sm text-xs">Select all</button>
						<button type="button" onclick={clearAll} class="btn-ghost btn-sm text-xs">Clear</button>
					</div>
				</div>
				<p class="text-sm text-muted-foreground">{selected.length} of {data.stores.length} selected</p>
			</div>
			<div class="card-content">
				{#if data.stores.length === 0}
					<p class="text-sm text-muted-foreground text-center py-4">
						No stores yet. <a href="/admin/stores/new" class="underline text-primary">Add one.</a>
					</p>
				{:else}
					<div class="space-y-2">
						{#each data.stores as store}
							<label class="flex items-center gap-4 border border-border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors {selected.includes(store.id) ? 'border-primary/50 bg-primary/5' : ''}">
								<input
									type="checkbox"
									name="storeIds"
									value={store.id}
									checked={selected.includes(store.id)}
									onchange={() => toggle(store.id)}
									class="rounded border-border size-4 shrink-0"
								/>
								<div class="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
									{store.name[0].toUpperCase()}
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm text-foreground">{store.name}</div>
								</div>
								{#if !store.isActive}
									<span class="badge-cancelled text-xs">Inactive</span>
								{/if}
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Save Access</button>
			<a href="/admin/couriers/{data.courier.id}" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
