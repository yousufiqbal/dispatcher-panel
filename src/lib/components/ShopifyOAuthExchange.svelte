<script lang="ts">
	let {
		shopifyDomain,
		clientId,
		redirectUri,
		scope,
		exchange,
		onToken
	}: {
		shopifyDomain: string;
		clientId: string;
		redirectUri: string;
		scope: string;
		exchange: (code: string) => Promise<string>;
		onToken: (token: string) => void;
	} = $props();

	let code = $state('');
	let exchanging = $state(false);
	let exchangeError = $state('');

	function authorizeUrl(): string {
		const params = new URLSearchParams({
			client_id: clientId,
			scope,
			redirect_uri: redirectUri,
			state: crypto.randomUUID()
		});
		return `https://${shopifyDomain}/admin/oauth/authorize?${params.toString()}`;
	}

	async function getToken() {
		if (!code.trim()) return;
		exchanging = true;
		exchangeError = '';
		try {
			const accessToken = await exchange(code.trim());
			onToken(accessToken);
			code = '';
		} catch (e) {
			exchangeError = e instanceof Error ? e.message : 'Token exchange failed';
		} finally {
			exchanging = false;
		}
	}
</script>

<div class="rounded-md border border-border divide-y divide-border">
	<div class="p-4">
		<div class="flex items-center gap-2 mb-1">
			<span class="flex items-center justify-center size-5 rounded-full bg-foreground text-background text-xs font-semibold">1</span>
			<span class="text-sm font-medium">Get code from Shopify</span>
		</div>
		<p class="text-xs text-muted-foreground mb-3">
			Opens the OAuth page. After you approve, Shopify redirects you — copy the
			<code class="text-xs bg-muted px-1 py-0.5 rounded">code=</code> value from that URL.
		</p>
		<a
			href={clientId && redirectUri ? authorizeUrl() : undefined}
			target="_blank"
			rel="noopener noreferrer"
			class="btn-secondary btn-sm inline-flex items-center gap-1.5"
			class:pointer-events-none={!clientId || !redirectUri}
			class:opacity-50={!clientId || !redirectUri}
		>
			Get Code
		</a>
	</div>

	<div class="p-4">
		<div class="flex items-center gap-2 mb-1">
			<span class="flex items-center justify-center size-5 rounded-full bg-foreground text-background text-xs font-semibold">2</span>
			<span class="text-sm font-medium">Paste code → get token</span>
		</div>
		<p class="text-xs text-muted-foreground mb-3">
			From the redirect URL, copy the <code class="text-xs bg-muted px-1 py-0.5 rounded">code</code> param and paste it below.
		</p>
		<div class="flex gap-2">
			<input class="input font-mono text-sm" placeholder="15dfb9768a085c9fe34c5a9..." bind:value={code} />
			<button type="button" class="btn-primary btn-sm shrink-0" disabled={exchanging || !code.trim()} onclick={getToken}>
				{exchanging ? 'Getting…' : 'Get Token'}
			</button>
		</div>
		{#if exchangeError}
			<p class="text-xs text-destructive mt-2">{exchangeError}</p>
		{/if}
	</div>
</div>
