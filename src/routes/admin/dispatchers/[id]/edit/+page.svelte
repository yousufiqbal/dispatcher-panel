<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import DangerZoneCard from '$lib/components/DangerZoneCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let isActive = $state(data.dispatcher.isActive);
</script>

<svelte:head>
	<title>Edit Dispatcher — {data.dispatcher.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack
		href="/admin/dispatchers/{data.dispatcher.id}"
		backTitle="Back to {data.dispatcher.name}"
		title="Edit Dispatcher"
		subtitle={data.dispatcher.email}
	/>

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
						if (result.type === 'success') addToast('Dispatcher updated');
					};
				}}
				class="space-y-5"
			>
				<input type="hidden" name="isActive" value={isActive} />

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<Label for="name">Full Name</Label>
						<Input id="name" name="name" value={data.dispatcher.name} required />
					</div>
					<div class="space-y-1.5">
						<Label for="email">Email</Label>
						<Input id="email" name="email" type="email" value={data.dispatcher.email} required />
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="password">New Password</Label>
					<Input id="password" name="password" type="password" placeholder="Leave blank to keep current" minlength={10} />
				</div>

				<div class="flex items-center gap-3">
					<Switch checked={isActive} onCheckedChange={(v) => isActive = v} />
					<span class="text-sm font-medium">{isActive ? 'Account active' : 'Account disabled'}</span>
				</div>

				<div class="flex items-center gap-3 pt-2">
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		</div>
	</div>

	<DangerZoneCard itemLabel="this dispatcher" description="Cannot be undone. All store access removed." />
</div>
