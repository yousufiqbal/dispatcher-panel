<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		open = $bindable(false),
		title = 'Delete this item?',
		description = 'This cannot be undone.',
		onConfirm
	}: {
		open?: boolean;
		title?: string;
		description?: string;
		onConfirm: () => void;
	} = $props();

	let confirmText = $state('');
	const canDelete = $derived(confirmText.trim().toLowerCase() === 'delete');

	function reset() {
		confirmText = '';
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(o) => {
		if (!o) reset();
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-1.5">
			<Label for="delete-confirm-input">Type <strong>delete</strong> to confirm</Label>
			<Input id="delete-confirm-input" bind:value={confirmText} placeholder="delete" autocomplete="off" />
		</div>

		<Dialog.Footer class="flex gap-3 sm:justify-start">
			<Button
				variant="destructive"
				disabled={!canDelete}
				onclick={() => {
					onConfirm();
					open = false;
					reset();
				}}
			>
				Permanently Delete
			</Button>
			<Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
