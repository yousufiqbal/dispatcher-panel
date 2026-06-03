<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');
	let step = $state<'credentials' | 'totp' | 'totp-setup'>('credentials');
	let totpCode = $state('');
	let qrDataUrl = $state('');
	let totpSecret = $state('');
	let setupStep = $state<'scan' | 'confirm'>('scan');

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
				body: JSON.stringify({ email, password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Login failed';
				return;
			}
			if (data.role === 'admin') {
				if (data.requiresTotpSetup) {
					await loadTotpSetup();
					step = 'totp-setup';
				} else {
					step = 'totp';
				}
			} else {
				goto('/dashboard');
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function loadTotpSetup() {
		const res = await fetch('/api/auth/totp/setup');
		const data = await res.json();
		qrDataUrl = data.qrDataUrl;
		totpSecret = data.secret;
	}

	async function handleTotp() {
		if (totpCode.length !== 6) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/auth/totp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: totpCode })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Invalid code';
				totpCode = '';
				return;
			}
			goto('/admin');
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
				body: JSON.stringify({ code: totpCode })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Invalid code';
				totpCode = '';
				return;
			}
			goto('/admin');
		} catch {
			error = 'Network error';
		} finally {
			loading = false;
		}
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
	<title>Sign In — Dispatcher Panel</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo / Branding -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground mb-4 shadow-sm">
				<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-foreground">Dispatcher Panel</h1>
			<p class="text-sm text-muted-foreground mt-1">Shopify Order Management</p>
		</div>

		<div class="card">
			{#if step === 'credentials'}
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
							<label class="label" for="email">Email</label>
							<input
								id="email"
								type="email"
								class="input"
								placeholder="you@example.com"
								bind:value={email}
								required
								autocomplete="email"
							/>
						</div>

						<div class="space-y-1.5">
							<label class="label" for="password">Password</label>
							<input
								id="password"
								type="password"
								class="input"
								placeholder="••••••••••"
								bind:value={password}
								required
								autocomplete="current-password"
							/>
						</div>

						<button type="submit" class="btn-primary w-full" disabled={loading}>
							{#if loading}
								<svg class="animate-spin size-4" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
								Signing in...
							{:else}
								Sign in
							{/if}
						</button>
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
						<label class="label" for="totp">Authentication code</label>
						<input
							id="totp"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							maxlength="6"
							class="input text-center text-2xl tracking-[0.5em] font-mono"
							placeholder="000000"
							value={totpCode}
							oninput={onTotpInput}
							autofocus
						/>
					</div>

					{#if loading}
						<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
							<svg class="animate-spin size-4" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							Verifying...
						</div>
					{/if}

					<button class="btn-ghost w-full text-sm" onclick={() => { step = 'credentials'; error = ''; totpCode = ''; }}>
						← Back to login
					</button>
				</div>

			{:else if step === 'totp-setup'}
				<div class="card-header">
					<h2 class="text-lg font-semibold">Set up two-factor authentication</h2>
					<p class="text-sm text-muted-foreground">2FA is mandatory for admin accounts</p>
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

						<button class="btn-primary w-full" onclick={() => setupStep = 'confirm'}>
							I've scanned the code →
						</button>

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
							<label class="label" for="setup-totp">Verification code</label>
							<input
								id="setup-totp"
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								maxlength="6"
								class="input text-center text-2xl tracking-[0.5em] font-mono"
								placeholder="000000"
								value={totpCode}
								oninput={onTotpInput}
								autofocus
							/>
						</div>

						<button
							class="btn-primary w-full"
							onclick={handleTotpSetupConfirm}
							disabled={loading || totpCode.length !== 6}
						>
							{loading ? 'Verifying...' : 'Confirm & enable 2FA'}
						</button>

						<button class="btn-ghost w-full text-sm" onclick={() => setupStep = 'scan'}>
							← Back to QR code
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
