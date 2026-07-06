<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);
</script>

<svelte:head>
	<title>New Customer — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/dispatcher/stores/{storeId}/customers" class="btn-secondary btn-icon shrink-0" title="Back to Customers">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
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
						<label class="label" for="firstName">First Name <span class="text-destructive">*</span></label>
						<input id="firstName" name="firstName" class="input" required />
					</div>
					<div class="space-y-1.5">
						<label class="label" for="lastName">Last Name <span class="text-destructive">*</span></label>
						<input id="lastName" name="lastName" class="input" required />
					</div>
				</div>
				<div class="space-y-1.5">
					<label class="label" for="email">Email</label>
					<input id="email" name="email" type="email" class="input" />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="phone">Phone</label>
					<input id="phone" name="phone" type="tel" class="input" />
				</div>
				<div class="flex gap-3 pt-2">
					<button type="submit" class="btn-primary">Create Customer</button>
					<a href="/dispatcher/stores/{storeId}/customers" class="btn-secondary">Cancel</a>
				</div>
			</form>
		</div>
	</div>
</div>
