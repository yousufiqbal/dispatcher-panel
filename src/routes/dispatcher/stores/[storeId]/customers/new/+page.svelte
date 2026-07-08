<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);
</script>

<svelte:head>
	<title>New Customer — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6 flex items-center gap-3">
		<Button href="/dispatcher/stores/{storeId}/customers" variant="outline" size="icon" class="shrink-0" title="Back to Customers">
			<ArrowLeftIcon class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">New Customer</h1>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.error}</div>
	{/if}

	<div class="card">
		<div class="card-content pt-6">
			<form method="POST" use:enhance class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<Label for="firstName">First Name <span class="text-destructive">*</span></Label>
						<Input id="firstName" name="firstName" required />
					</div>
					<div class="space-y-1.5">
						<Label for="lastName">Last Name <span class="text-destructive">*</span></Label>
						<Input id="lastName" name="lastName" required />
					</div>
				</div>
				<div class="space-y-1.5">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" />
				</div>
				<div class="space-y-1.5">
					<Label for="phone">Phone</Label>
					<Input id="phone" name="phone" type="tel" />
				</div>
				<div class="flex gap-3 pt-2">
					<Button type="submit">Create Customer</Button>
					<Button href="/dispatcher/stores/{storeId}/customers" variant="outline">Cancel</Button>
				</div>
			</form>
		</div>
	</div>
</div>
