<script lang="ts">
	import { enhance } from '$app/forms';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		itemLabel,
		description,
		deleteFormAction = '?/delete'
	}: {
		itemLabel: string;
		description: string;
		deleteFormAction?: string;
	} = $props();

	let confirmDelete = $state(false);
	let deleteFormEl: HTMLFormElement;
</script>

<div class="card border-destructive/30">
	<div class="card-header">
		<h2 class="text-sm font-semibold text-destructive">Danger Zone</h2>
	</div>
	<div class="card-content flex items-center justify-between">
		<div>
			<div class="text-sm font-medium">Delete {itemLabel}</div>
			<div class="text-xs text-muted-foreground">{description}</div>
		</div>
		<form method="POST" action={deleteFormAction} use:enhance bind:this={deleteFormEl} class="hidden"></form>
		<Button variant="destructive" size="sm" onclick={() => (confirmDelete = true)}>Delete</Button>
	</div>
</div>

<DeleteConfirmDialog
	bind:open={confirmDelete}
	title="Delete {itemLabel}?"
	{description}
	onConfirm={() => deleteFormEl.requestSubmit()}
/>
