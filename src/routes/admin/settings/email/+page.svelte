<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Email — Admin Settings</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<nav class="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
			<a href="/admin/settings" class="hover:text-foreground transition-colors">Settings</a>
			<ChevronRightIcon class="size-3" />
			<span class="text-foreground font-medium">Email Address</span>
		</nav>
		<div class="flex items-center gap-3">
			<Button href="/admin/settings" variant="outline" size="icon" class="shrink-0" title="Back to Settings">
				<ArrowLeftIcon class="size-4" />
			</Button>
			<h1 class="text-2xl font-bold">Email Address</h1>
		</div>
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
				<Input name="email" type="email" class="flex-1" placeholder="new@email.com" required />
				<Button type="submit" class="shrink-0">Update Email</Button>
			</form>
		</div>
	</div>
</div>
