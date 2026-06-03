<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Settings — Admin</title>
</svelte:head>

<div class="p-8 max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Account Settings</h1>
		<p class="text-sm text-muted-foreground mt-1">Manage admin email, password, and 2FA</p>
	</div>

	<!-- Email -->
	<div class="card">
		<div class="card-header">
			<h2 class="text-base font-semibold">Email Address</h2>
			<p class="text-sm text-muted-foreground">Current: <strong>{data.email}</strong></p>
		</div>
		<div class="card-content">
			{#if form?.emailSuccess}
				<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">Email updated.</div>
			{/if}
			{#if form?.emailError}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.emailError}</div>
			{/if}
			<form method="POST" action="?/updateEmail" use:enhance class="flex gap-3">
				<input name="email" type="email" class="input flex-1" placeholder="new@email.com" required />
				<button type="submit" class="btn-primary shrink-0">Update Email</button>
			</form>
		</div>
	</div>

	<!-- Password -->
	<div class="card">
		<div class="card-header">
			<h2 class="text-base font-semibold">Password</h2>
		</div>
		<div class="card-content">
			{#if form?.passSuccess}
				<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">Password updated.</div>
			{/if}
			{#if form?.passError}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.passError}</div>
			{/if}
			<form method="POST" action="?/updatePassword" use:enhance class="space-y-4">
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

	<!-- 2FA -->
	<div class="card">
		<div class="card-header">
			<h2 class="text-base font-semibold">Two-Factor Authentication</h2>
			<p class="text-sm text-muted-foreground">
				Status: {#if data.totpEnabled}<span class="text-green-700 font-medium">Enabled</span>{:else}<span class="text-destructive font-medium">Disabled</span>{/if}
			</p>
		</div>
		<div class="card-content">
			{#if form?.totpDisabled}
				<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">2FA disabled. You will be prompted to set it up on next login.</div>
			{/if}
			{#if data.totpEnabled}
				<p class="text-sm text-muted-foreground mb-4">Disabling 2FA will require you to set it up again on next login.</p>
				<form method="POST" action="?/disableTotp" use:enhance>
					<button type="submit" class="btn-destructive">Disable 2FA</button>
				</form>
			{:else}
				<p class="text-sm text-muted-foreground">2FA is not active. Log out and log back in to trigger setup.</p>
			{/if}
		</div>
	</div>
</div>
