<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let saving = $state(false);
</script>

<svelte:head><title>Settings</title></svelte:head>

<div class="p-3 sm:p-6 max-w-2xl mx-auto space-y-4">
	<div>
		<h1 class="text-xl font-bold text-foreground">Settings</h1>
		<p class="text-sm text-muted-foreground mt-1">Only you can see this page.</p>
	</div>

	<form
		method="POST"
		action="?/leadTimes"
		class="card p-5 space-y-4"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') addToast('Lead times saved');
				else if (result.type === 'failure') addToast((result.data?.error as string) ?? "Couldn't save", 'error');
				await update({ reset: false });
			};
		}}
	>
		<div>
			<h2 class="text-sm font-semibold text-foreground">Restock lead times</h2>
			<p class="text-xs text-muted-foreground mt-0.5">How many days an air or sea shipment takes to arrive. Restock sizes its recommendations so stock lasts until the order lands.</p>
		</div>
		<div class="grid grid-cols-2 gap-3 max-w-sm">
			<div class="space-y-1.5">
				<Label for="air">✈ Air (days)</Label>
				<Input id="air" name="airLeadDays" type="number" min="1" max="365" value={data.airLeadDays} required />
			</div>
			<div class="space-y-1.5">
				<Label for="sea">🚢 Sea (days)</Label>
				<Input id="sea" name="seaLeadDays" type="number" min="1" max="365" value={data.seaLeadDays} required />
			</div>
		</div>
		<Button type="submit" disabled={saving}>
			{#if saving}<Loader2Icon class="size-4 animate-spin" />{/if}
			Save
		</Button>
	</form>
</div>
