<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let isActive = $state(data.dispatcher.isActive);
	let confirmDelete = $state(false);
</script>

<svelte:head>
	<title>Edit Dispatcher — {data.dispatcher.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/dispatchers/{data.dispatcher.id}" class="btn-secondary btn-icon shrink-0" title="Back to {data.dispatcher.name}">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Edit Dispatcher</h1>
		</div>
		<p class="text-sm text-muted-foreground mt-1">{data.dispatcher.email}</p>
	</div>

	{#if form?.errors}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
			<ul class="list-disc list-inside space-y-1">
				{#each form.errors as err}<li>{err}</li>{/each}
			</ul>
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-6">Changes saved.</div>
	{/if}

	<div class="card mb-4">
		<div class="card-content pt-6">
			<form method="POST" action="?/update" use:enhance class="space-y-5">
				<input type="hidden" name="isActive" value={isActive} />

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<label class="label" for="name">Full Name</label>
						<input id="name" name="name" class="input" value={data.dispatcher.name} required />
					</div>
					<div class="space-y-1.5">
						<label class="label" for="email">Email</label>
						<input id="email" name="email" type="email" class="input" value={data.dispatcher.email} required />
					</div>
				</div>

				<div class="space-y-1.5">
					<label class="label" for="password">New Password</label>
					<input id="password" name="password" type="password" class="input" placeholder="Leave blank to keep current" minlength="10" />
				</div>

				<div class="flex items-center gap-3">
					<button
						type="button"
						role="switch"
						aria-checked={isActive}
						onclick={() => isActive = !isActive}
						class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {isActive ? 'bg-primary' : 'bg-muted-foreground/30'}"
					>
						<span class="inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 {isActive ? 'translate-x-6' : 'translate-x-1'}" />
					</button>
					<span class="text-sm font-medium">{isActive ? 'Account active' : 'Account disabled'}</span>
				</div>

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
				<div class="text-sm font-medium">Delete this dispatcher</div>
				<div class="text-xs text-muted-foreground">Cannot be undone. All store access removed.</div>
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
