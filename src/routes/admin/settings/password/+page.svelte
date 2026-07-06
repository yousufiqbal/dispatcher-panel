<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Password — Admin Settings</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/admin/settings" class="btn-secondary btn-icon shrink-0" title="Back to Settings">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold">Password</h1>
		</div>
	</div>

	<div class="card">
		<div class="card-content pt-6">
			{#if form?.passSuccess}
				<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">Password updated.</div>
			{/if}
			{#if form?.passError}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.passError}</div>
			{/if}
			<form method="POST" use:enhance class="space-y-4">
				<div class="space-y-1.5">
					<label class="label" for="currentPassword">Current Password</label>
					<input id="currentPassword" name="currentPassword" type="password" class="input" required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="newPassword">New Password</label>
					<input id="newPassword" name="newPassword" type="password" class="input" minlength="10" required />
				</div>
				<div class="space-y-1.5">
					<label class="label" for="confirmPassword">Confirm New Password</label>
					<input id="confirmPassword" name="confirmPassword" type="password" class="input" required />
				</div>
				<button type="submit" class="btn-primary">Update Password</button>
			</form>
		</div>
	</div>
</div>
