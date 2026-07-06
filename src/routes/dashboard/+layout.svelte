<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let storeSheetOpen = $state(false);
	let logoutConfirmOpen = $state(false);
	let navHidden = $state(false);
	let lastScrollY = 0;

	function onScroll(e: Event) {
		const target = (e.target === document ? document.documentElement : e.target) as HTMLElement;
		const y = target.scrollTop ?? 0;
		navHidden = y > lastScrollY && y > 60;
		lastScrollY = y;
	}

	$effect(() => {
		document.addEventListener('scroll', onScroll, { capture: true, passive: true });
		return () => document.removeEventListener('scroll', onScroll, true);
	});

	function isStoreActive(storeId: string) {
		return $page.url.pathname.includes(`/dashboard/stores/${storeId}`);
	}

	const currentStoreId = $derived($page.params.storeId as string | undefined);
	const currentStoreName = $derived(data.assignedStores.find((s) => s.id === currentStoreId)?.name);

	function tabHref(sub: string) {
		return currentStoreId ? `/dashboard/stores/${currentStoreId}/${sub}` : undefined;
	}

	function isTabActive(sub: string) {
		return $page.url.pathname.includes(`/${sub}`);
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}

	// close sheet on navigation
	$effect(() => {
		$page.url.pathname;
		storeSheetOpen = false;
	});
</script>

<div class="min-h-screen bg-zinc-50 flex">
	<!-- Sidebar (desktop only) -->
	<aside class="fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col bg-card border-r border-border w-64 shadow-sm">
		<!-- Logo -->
		<div class="flex items-center gap-3 px-5 py-4 border-b border-border">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">D</div>
			<div class="flex-1 min-w-0">
				<div class="text-sm font-semibold text-foreground truncate">Dispatcher Panel</div>
				<div class="text-xs text-muted-foreground truncate">{data.dispatcher?.name}</div>
			</div>
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
							{store.name[0].toUpperCase()}
						</div>
						<span class="truncate">{store.name}</span>
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
	<div class="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-64">
		<main class="flex-1 pt-16 lg:pt-0">
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile top nav -->
<nav class="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-border flex items-stretch h-16 pt-[env(safe-area-inset-top)] transition-transform duration-200 {navHidden ? '-translate-y-full' : 'translate-y-0'}">
	<!-- Store switcher -->
	<button
		onclick={() => storeSheetOpen = true}
		class="relative w-[40%] flex items-center gap-2.5 px-4 overflow-hidden
			{storeSheetOpen ? 'text-primary' : 'text-foreground'}"
	>
		<span class="flex-1 min-w-0 text-left">
			<span class="block text-sm font-semibold truncate">{currentStoreName ?? 'Select Store'}</span>
			<span class="block text-[10px] text-muted-foreground">Tap to switch</span>
		</span>
	</button>

	<!-- Orders / Customers / Logout -->
	<div class="flex w-[60%] border-l border-border">
		<a
			href={tabHref('orders')}
			class="relative flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors
				{!currentStoreId ? 'pointer-events-none opacity-40' : isTabActive('orders') ? 'text-primary' : 'text-muted-foreground'}"
		>
			<span class="flex items-center justify-center size-7 rounded-full {currentStoreId && isTabActive('orders') ? 'bg-primary/10' : ''}">
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
			</span>
			<span class="font-medium">Orders</span>
		</a>
		<a
			href={tabHref('customers')}
			class="relative flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors
				{!currentStoreId ? 'pointer-events-none opacity-40' : isTabActive('customers') ? 'text-primary' : 'text-muted-foreground'}"
		>
			<span class="flex items-center justify-center size-7 rounded-full {currentStoreId && isTabActive('customers') ? 'bg-primary/10' : ''}">
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
				</svg>
			</span>
			<span class="font-medium">Customers</span>
		</a>
		<button
			onclick={() => logoutConfirmOpen = true}
			class="flex-1 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
		>
			<span class="flex items-center justify-center size-7 rounded-full">
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
				</svg>
			</span>
			<span class="font-medium">Logout</span>
		</button>
	</div>
</nav>

<!-- Mobile store picker (drop-down) -->
{#if storeSheetOpen}
	<div
		class="lg:hidden fixed inset-0 z-40"
		role="button"
		tabindex="-1"
		onclick={() => storeSheetOpen = false}
		onkeydown={(e) => e.key === 'Escape' && (storeSheetOpen = false)}
	></div>
	<div
		transition:slide={{ duration: 180 }}
		class="lg:hidden fixed top-16 inset-x-0 z-50 bg-card/95 backdrop-blur border-b border-border rounded-b-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] max-h-[60vh] flex flex-col"
	>
		<div class="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
			<span class="text-sm font-semibold text-foreground">Select Store</span>
			<button onclick={() => storeSheetOpen = false} class="btn-icon text-muted-foreground">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
		<div class="overflow-y-auto p-2 space-y-0.5">
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
							{store.name[0].toUpperCase()}
						</div>
						<span class="truncate">{store.name}</span>
					</a>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<!-- Logout confirm modal -->
{#if logoutConfirmOpen}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-sm shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Sign out?</h2>
				<p class="text-sm text-muted-foreground">You'll need to log in again to access the panel.</p>
			</div>
			<div class="card-content flex gap-3">
				<button class="btn-destructive" onclick={logout}>Sign Out</button>
				<button class="btn-secondary" onclick={() => logoutConfirmOpen = false}>Cancel</button>
			</div>
		</div>
	</div>
{/if}
