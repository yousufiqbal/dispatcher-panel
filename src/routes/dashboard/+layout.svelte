<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let mobileOpen = $state(false);

	function isStoreActive(storeId: string) {
		return $page.url.pathname.includes(`/dashboard/stores/${storeId}`);
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}

	// close drawer on navigation
	$effect(() => {
		$page.url.pathname;
		mobileOpen = false;
	});
</script>

<!-- Mobile overlay -->
{#if mobileOpen}
	<div
		class="fixed inset-0 bg-black/40 z-40 lg:hidden"
		role="button"
		tabindex="-1"
		onclick={() => mobileOpen = false}
		onkeydown={(e) => e.key === 'Escape' && (mobileOpen = false)}
	></div>
{/if}

<div class="min-h-screen bg-zinc-50 flex">
	<!-- Sidebar -->
	<aside class="
		fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border w-64 shadow-sm
		transition-transform duration-200
		lg:translate-x-0
		{mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
	">
		<!-- Logo -->
		<div class="flex items-center gap-3 px-5 py-4 border-b border-border">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">D</div>
			<div class="flex-1 min-w-0">
				<div class="text-sm font-semibold text-foreground truncate">Dispatcher Panel</div>
				<div class="text-xs text-muted-foreground truncate">{data.dispatcher?.name}</div>
			</div>
			<button class="lg:hidden btn-icon text-muted-foreground" onclick={() => mobileOpen = false}>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Stores list -->
		<nav class="flex-1 p-2 space-y-0.5 overflow-y-auto">
			<div class="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stores</div>

			{#if data.assignedStores.length === 0}
				<p class="px-3 py-2 text-xs text-muted-foreground">No stores assigned</p>
			{:else}
				{#each data.assignedStores as store}
					<a
						href="/dashboard/stores/{store.id}/orders"
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150
							{isStoreActive(store.id)
								? 'bg-primary/10 text-primary font-medium'
								: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					>
						<div class="size-7 rounded-md bg-current/10 flex items-center justify-center text-xs font-bold shrink-0">
							{store.nickname[0].toUpperCase()}
						</div>
						<span class="truncate">{store.nickname}</span>
					</a>
				{/each}
			{/if}
		</nav>

		<!-- User footer -->
		<div class="p-2 border-t border-border">
			<div class="flex items-center gap-3 px-3 py-2 rounded-lg">
				<div class="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
					{data.dispatcher?.name?.[0]?.toUpperCase() ?? 'D'}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-xs font-medium text-foreground truncate">{data.dispatcher?.name}</div>
					<div class="text-xs text-muted-foreground truncate">{data.dispatcher?.email}</div>
				</div>
				<button onclick={logout} title="Sign out" class="btn-icon text-muted-foreground hover:text-foreground shrink-0">
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
				</button>
			</div>
		</div>
	</aside>

	<!-- Main -->
	<div class="flex-1 flex flex-col min-h-screen lg:ml-64">
		<!-- Mobile top bar -->
		<div class="lg:hidden flex items-center gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
			<button onclick={() => mobileOpen = true} class="btn-icon text-muted-foreground">
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<span class="text-sm font-semibold text-foreground truncate">
				{data.assignedStores.find(s => $page.url.pathname.includes(s.id))?.nickname ?? 'Dispatcher Panel'}
			</span>
		</div>

		<main class="flex-1">
			{@render children()}
		</main>
	</div>
</div>
