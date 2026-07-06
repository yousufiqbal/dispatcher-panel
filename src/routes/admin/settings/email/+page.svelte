<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Email — Admin Settings</title>
</svelte:head>

<div class="p-8 max-w-2xl">
	<div class="mb-6">
		<a href="/admin/settings" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Settings
		</a>
		<h1 class="text-2xl font-bold">Email Address</h1>
		<p class="text-sm text-muted-foreground mt-1">Current: <strong>{form?.email ?? data.email}</strong></p>
	</div>

	<div class="card">
		<div class="card-content pt-6">
			{#if form?.emailSuccess}
				<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">Email updated.</div>
			{/if}
			{#if form?.emailError}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.emailError}</div>
			{/if}
			<form method="POST" use:enhance class="flex gap-3">
				<input name="email" type="email" class="input flex-1" placeholder="new@email.com" required />
				<button type="submit" class="btn-primary shrink-0">Update Email</button>
			</form>
		</div>
	</div>
</div>
