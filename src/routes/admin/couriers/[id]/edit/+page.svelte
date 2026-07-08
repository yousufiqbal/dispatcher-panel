<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import PageHeaderBack from '$lib/components/PageHeaderBack.svelte';
	import DangerZoneCard from '$lib/components/DangerZoneCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let enabled = $state(data.courier.enabled);
	let defaultFragile = $state(data.courier.defaultFragile);
	let provider = $state(data.courier.provider);

	const providerLabels: Record<string, string> = { postex: 'PostEx', dex: 'DEX' };
</script>

<svelte:head>
	<title>Edit Courier — {data.courier.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<PageHeaderBack href="/admin/couriers/{data.courier.id}" backTitle="Back to {data.courier.name}" title="Edit Courier" />

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
						<Label for="name">Courier Name</Label>
						<Input id="name" name="name" value={data.courier.name} required />
					</div>
					<div class="space-y-1.5">
						<Label for="provider">Provider</Label>
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
					<Input id="apiKey" name="apiKey" type="password" placeholder={data.courier.hasApiKey ? 'Leave blank to keep current key' : 'API key'} />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label class="text-xs" for="defaultWeight">Default Weight (g)</Label>
						<Input id="defaultWeight" name="defaultWeight" value={data.courier.defaultWeight ?? ''} placeholder="500" />
					</div>
					<label class="flex items-center gap-2 cursor-pointer text-sm self-end pb-2">
						<Checkbox name="defaultFragile" value="true" bind:checked={defaultFragile} />
						Fragile by default
					</label>
				</div>

				<div class="space-y-1.5">
					<Label class="text-xs" for="defaultNote">Default Note</Label>
					<Input id="defaultNote" name="defaultNote" value={data.courier.defaultNote ?? ''} placeholder="Optional note added to every booking" />
				</div>

				<label class="flex items-center gap-2 cursor-pointer text-sm">
					<Checkbox name="enabled" value="true" bind:checked={enabled} />
					Enabled
				</label>

				<div class="flex items-center gap-3 pt-2">
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		</div>
	</div>

	<DangerZoneCard itemLabel="this courier" description="Cannot be undone. Store assignments removed." />
</div>
