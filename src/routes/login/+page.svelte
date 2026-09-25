<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import PackageIcon from '@lucide/svelte/icons/package';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state('');
	let step = $state<'credentials' | 'register' | 'totp' | 'totp-setup'>(
		data.pending ?? (data.hasAdmin ? 'credentials' : 'register')
	);
	let totpCode = $state('');
	let qrDataUrl = $state('');
	let totpSecret = $state('');
	let setupStep = $state<'scan' | 'confirm'>('scan');
	// Carried from the credentials form into the code step — the device is only
	// remembered once a code actually verifies.
	let remember = $state(false);

	// Resuming a half-finished sign-in (page reload) lands straight on setup.
	$effect(() => {
		if (step === 'totp-setup' && !qrDataUrl) loadTotpSetup();
	});

	async function handleRegister() {
		if (!email || !password) {
			error = 'Email and password are required';
			return;
		}
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/auth/register-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const resData = await res.json();
			if (!res.ok) {
				error = resData.error ?? 'Registration failed';
				return;
			}
			goto('/admin');
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleLogin() {
		if (!email || !password) {
			error = 'Email and password are required';
			return;
		}
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, remember })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Login failed';
				return;
			}
			// A dispatcher without a verified code gets the 2FA step instead of
			// a redirect — either enrolment or the usual prompt.
			if (data.next === 'totp-setup') {
				totpCode = '';
				setupStep = 'scan';
				step = 'totp-setup';
				await loadTotpSetup();
				return;
			}
			if (data.next === 'totp') {
				totpCode = '';
				step = 'totp';
				return;
			}
			goto(data.redirect ?? '/dispatcher');
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function loadTotpSetup() {
		const res = await fetch('/api/auth/totp/setup');
		const payload = await res.json();
		if (!res.ok) {
			error = payload.error ?? 'Could not start two-factor setup';
			return;
		}
		qrDataUrl = payload.qrDataUrl;
		totpSecret = payload.secret;
	}

	async function handleTotp() {
		if (totpCode.length !== 6) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/auth/totp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: totpCode, remember })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Invalid code';
				totpCode = '';
				return;
			}
			goto(data.redirect ?? '/dispatcher');
		} catch {
			error = 'Network error';
		} finally {
			loading = false;
		}
	}

	async function handleTotpSetupConfirm() {
		if (totpCode.length !== 6) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/auth/totp/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: totpCode, remember })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Invalid code';
				totpCode = '';
				return;
			}
			goto(data.redirect ?? '/dispatcher');
		} catch {
			error = 'Network error';
		} finally {
			loading = false;
		}
	}

	// Abandoning the code step drops the password-only session, so a half-signed-in
	// browser can't be left sitting on an unverified cookie.
	async function cancelSignIn() {
		await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
		step = 'credentials';
		error = '';
		totpCode = '';
		password = '';
		qrDataUrl = '';
		totpSecret = '';
	}

	function onTotpInput(e: Event) {
		const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
		totpCode = val;
		if (val.length === 6) {
			if (step === 'totp') handleTotp();
			else handleTotpSetupConfirm();
		}
	}
</script>

<svelte:head>
	<title>Sign In — Pro Shipper</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo / Branding -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground mb-4 shadow-sm">
				<PackageIcon class="size-6" />
			</div>
			<h1 class="text-2xl font-bold text-foreground">Pro Shipper</h1>
			<p class="text-sm text-muted-foreground mt-1">Shopify Order Management</p>
		</div>

		<div class="card">
			{#if step === 'register'}
				<div class="card-header">
					<h2 class="text-lg font-semibold">Set up the admin account</h2>
					<p class="text-sm text-muted-foreground">No admin account exists yet — create one to get started</p>
				</div>
				<div class="card-content">
					<form onsubmit={(e) => { e.preventDefault(); handleRegister(); }} class="space-y-4">
						{#if error}
							<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
								{error}
							</div>
						{/if}

						<div class="space-y-1.5">
							<Label for="reg-email">Email</Label>
							<Input
								id="reg-email"
								type="email"
								placeholder="you@example.com"
								bind:value={email}
								required
								autocomplete="email"
							/>
						</div>

						<div class="space-y-1.5">
							<Label for="reg-password">Password</Label>
							<Input
								id="reg-password"
								type="password"
								placeholder="At least 10 characters"
								bind:value={password}
								minlength={10}
								required
								autocomplete="new-password"
							/>
						</div>

						<div class="space-y-1.5">
							<Label for="reg-confirm-password">Confirm password</Label>
							<Input
								id="reg-confirm-password"
								type="password"
								placeholder="••••••••••"
								bind:value={confirmPassword}
								required
								autocomplete="new-password"
							/>
						</div>

						<Button type="submit" class="w-full" disabled={loading}>
							{#if loading}
								<Loader2Icon class="animate-spin size-4" />
								Creating account...
							{:else}
								Create admin account
							{/if}
						</Button>
					</form>
				</div>

			{:else if step === 'credentials'}
				<div class="card-header">
					<h2 class="text-lg font-semibold">Sign in to your account</h2>
					<p class="text-sm text-muted-foreground">Enter your credentials to continue</p>
				</div>
				<div class="card-content">
					<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
						{#if error}
							<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
								{error}
							</div>
						{/if}

						<div class="space-y-1.5">
							<Label for="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="you@example.com"
								bind:value={email}
								required
								autocomplete="email"
							/>
						</div>

						<div class="space-y-1.5">
							<Label for="password">Password</Label>
							<Input
								id="password"
								type="password"
								placeholder="••••••••••"
								bind:value={password}
								required
								autocomplete="current-password"
							/>
						</div>

						<label class="flex items-start gap-2.5 cursor-pointer select-none">
							<input
								type="checkbox"
								bind:checked={remember}
								class="mt-0.5 size-4 rounded border-input accent-primary"
							/>
							<span class="text-sm text-muted-foreground leading-tight">
								Remember this device for 30 days
								<span class="block text-xs text-muted-foreground/80">Skips the authenticator code on this browser</span>
							</span>
						</label>

						<Button type="submit" class="w-full" disabled={loading}>
							{#if loading}
								<Loader2Icon class="animate-spin size-4" />
								Signing in...
							{:else}
								Sign in
							{/if}
						</Button>
					</form>
				</div>

			{:else if step === 'totp'}
				<div class="card-header">
					<h2 class="text-lg font-semibold">Two-factor authentication</h2>
					<p class="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
				</div>
				<div class="card-content space-y-4">
					{#if error}
						<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
							{error}
						</div>
					{/if}

					<div class="space-y-1.5">
						<Label for="totp">Authentication code</Label>
						<Input
							id="totp"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							maxlength={6}
							class="text-center text-2xl tracking-[0.5em] font-mono"
							placeholder="000000"
							value={totpCode}
							oninput={onTotpInput}
							autofocus
						/>
					</div>

					{#if loading}
						<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2Icon class="animate-spin size-4" />
							Verifying...
						</div>
					{/if}

					<Button variant="ghost" class="w-full text-sm" onclick={cancelSignIn}>
						← Back to login
					</Button>
				</div>

			{:else if step === 'totp-setup'}
				<div class="card-header">
					<h2 class="text-lg font-semibold">Set up two-factor authentication</h2>
					<p class="text-sm text-muted-foreground">Two-factor authentication is required on every account</p>
				</div>
				<div class="card-content space-y-4">
					{#if setupStep === 'scan'}
						<p class="text-sm text-muted-foreground">
							Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
						</p>

						{#if qrDataUrl}
							<div class="flex justify-center">
								<div class="border border-border rounded-lg p-3 bg-white shadow-sm">
									<img src={qrDataUrl} alt="TOTP QR Code" class="size-48" />
								</div>
							</div>
						{/if}

						{#if totpSecret}
							<div class="rounded-md bg-muted px-3 py-2 text-center">
								<p class="text-xs text-muted-foreground mb-1">Or enter this code manually:</p>
								<code class="text-sm font-mono font-semibold tracking-wider">{totpSecret}</code>
							</div>
						{/if}

						<Button class="w-full" onclick={() => setupStep = 'confirm'}>
							I've scanned the code →
						</Button>

					{:else}
						<p class="text-sm text-muted-foreground">
							Enter the 6-digit code from your authenticator app to confirm setup.
						</p>

						{#if error}
							<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
								{error}
							</div>
						{/if}

						<div class="space-y-1.5">
							<Label for="setup-totp">Verification code</Label>
							<Input
								id="setup-totp"
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								maxlength={6}
								class="text-center text-2xl tracking-[0.5em] font-mono"
								placeholder="000000"
								value={totpCode}
								oninput={onTotpInput}
								autofocus
							/>
						</div>

						<Button
							class="w-full"
							onclick={handleTotpSetupConfirm}
							disabled={loading || totpCode.length !== 6}
						>
							{loading ? 'Verifying...' : 'Confirm & enable 2FA'}
						</Button>

						<Button variant="ghost" class="w-full text-sm" onclick={() => setupStep = 'scan'}>
							← Back to QR code
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
