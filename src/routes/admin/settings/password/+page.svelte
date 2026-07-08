<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Password — Admin Settings</title>
</svelte:head>

<div class="p-3 sm:p-6 max-w-2xl">
	<div class="mb-6">
		<nav class="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
			<a href="/admin/settings" class="hover:text-foreground transition-colors">Settings</a>
			<ChevronRightIcon class="size-3" />
			<span class="text-foreground font-medium">Password</span>
		</nav>
		<div class="flex items-center gap-3">
			<Button href="/admin/settings" variant="outline" size="icon" class="shrink-0" title="Back to Settings">
				<ArrowLeftIcon class="size-4" />
			</Button>
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
					<Label for="currentPassword">Current Password</Label>
					<Input id="currentPassword" name="currentPassword" type="password" required />
				</div>
				<div class="space-y-1.5">
					<Label for="newPassword">New Password</Label>
					<Input id="newPassword" name="newPassword" type="password" minlength={10} required />
				</div>
				<div class="space-y-1.5">
					<Label for="confirmPassword">Confirm New Password</Label>
					<Input id="confirmPassword" name="confirmPassword" type="password" required />
				</div>
				<Button type="submit">Update Password</Button>
			</form>
		</div>
	</div>
</div>
