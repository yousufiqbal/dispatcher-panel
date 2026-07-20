<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import PackageIcon from '@lucide/svelte/icons/package';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}
</script>

<div class="min-h-screen bg-zinc-50">
	<header class="sticky top-0 z-30 bg-card border-b border-border">
		<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground">
					<PackageIcon class="size-4" />
				</div>
				<div>
					<div class="text-sm font-semibold text-foreground leading-tight">Pro Shipper</div>
					<div class="text-xs text-muted-foreground leading-tight">Accounting</div>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-xs text-muted-foreground hidden sm:block">{data.accountant?.name}</span>
				<Button onclick={logout} variant="ghost" size="icon" title="Sign out" class="text-muted-foreground hover:text-foreground">
					<LogOutIcon class="size-4" />
				</Button>
			</div>
		</div>
	</header>

	<main>
		{@render children()}
	</main>
</div>
