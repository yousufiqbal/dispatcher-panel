<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { isStoreSwitcherOpen, openStoreSwitcher, closeStoreSwitcher } from '$lib/storeSwitcher.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const storeSheetOpen = $derived(isStoreSwitcherOpen());
	let logoutConfirmOpen = $state(false);

	function isStoreActive(storeId: string) {
		return $page.url.pathname.includes(`/dispatcher/stores/${storeId}`);
	}

	const currentStoreId = $derived($page.params.storeId as string | undefined);
	const currentStore = $derived(data.assignedStores.find((s) => s.id === currentStoreId));
	const currentStoreName = $derived(currentStore?.name);
	const currentStoreLogo = $derived(currentStore?.logoUrl ?? null);

	function tabHref(sub: string) {
		return currentStoreId ? `/dispatcher/stores/${currentStoreId}/${sub}` : undefined;
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
		closeStoreSwitcher();
	});
</script>

<div class="min-h-screen bg-zinc-50 flex">
	<!-- Sidebar (desktop only) -->
	<aside class="fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col bg-card border-r border-border w-64 shadow-sm">
		<!-- Logo -->
		<div class="flex items-center gap-3 px-5 h-[73px] bg-card shadow-sm">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">D</div>
			<div class="flex-1 min-w-0">
				<div class="text-lg font-semibold text-foreground truncate">Pro Shipper</div>
				<div class="text-xs text-muted-foreground truncate">{data.dispatcher?.name}</div>
			</div>
		</div>

		<!-- Section links -->
		<nav class="flex-1 p-2 pt-[100px] space-y-0.5 overflow-y-auto">
			{#each [
				{ href: 'orders', label: 'Orders', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
				{ href: 'customers', label: 'Customers', d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
				{ href: 'products', label: 'Products', d: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
				{ href: 'inventory', label: 'Inventory', d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7' }
			] as item}
				<a
					href={tabHref(item.href)}
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150
						{!currentStoreId ? 'pointer-events-none opacity-40' : ''}
						{isTabActive(item.href)
							? 'bg-primary/10 text-primary font-medium'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				>
					<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d={item.d} />
					</svg>
					{item.label}
				</a>
			{/each}
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
				<button onclick={() => logoutConfirmOpen = true} title="Sign out" class="btn-icon text-muted-foreground hover:text-foreground shrink-0">
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
				</button>
			</div>
		</div>
	</aside>

	<!-- Main -->
	<div class="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-64">
		<main class="flex-1 pb-16 lg:pb-0">
			{#key $page.url.pathname}
				<div class="animate-fade-in-up">
					{@render children()}
				</div>
			{/key}
		</main>
	</div>
</div>

<!-- Mobile bottom nav -->
<nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex h-16 pb-[env(safe-area-inset-bottom)]">
	<a
		href={tabHref('orders')}
		class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
			{!currentStoreId ? 'pointer-events-none opacity-40' : isTabActive('orders') ? 'text-primary' : 'text-muted-foreground'}"
	>
		<span class="flex items-center justify-center size-8 rounded-full {isTabActive('orders') ? 'bg-primary/10' : ''}">
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
			</svg>
		</span>
		<span class="font-medium">Orders</span>
	</a>
	<a
		href={tabHref('customers')}
		class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
			{!currentStoreId ? 'pointer-events-none opacity-40' : isTabActive('customers') ? 'text-primary' : 'text-muted-foreground'}"
	>
		<span class="flex items-center justify-center size-8 rounded-full {isTabActive('customers') ? 'bg-primary/10' : ''}">
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
		</span>
		<span class="font-medium">Customers</span>
	</a>
	<a
		href={tabHref('products')}
		class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
			{!currentStoreId ? 'pointer-events-none opacity-40' : isTabActive('products') ? 'text-primary' : 'text-muted-foreground'}"
	>
		<span class="flex items-center justify-center size-8 rounded-full {isTabActive('products') ? 'bg-primary/10' : ''}">
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
			</svg>
		</span>
		<span class="font-medium">Products</span>
	</a>
	<a
		href={tabHref('inventory')}
		class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
			{!currentStoreId ? 'pointer-events-none opacity-40' : isTabActive('inventory') ? 'text-primary' : 'text-muted-foreground'}"
	>
		<span class="flex items-center justify-center size-8 rounded-full {isTabActive('inventory') ? 'bg-primary/10' : ''}">
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
			</svg>
		</span>
		<span class="font-medium">Inventory</span>
	</a>
	<button
		onclick={() => openStoreSwitcher()}
		class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs {storeSheetOpen ? 'text-primary' : 'text-muted-foreground'}"
		title="Switch store"
	>
		<span class="flex items-center justify-center size-8 rounded-full {storeSheetOpen ? 'bg-primary/10' : ''}">
			{#if currentStoreLogo}
				<img src={currentStoreLogo} alt="" class="size-5 rounded object-contain" />
			{:else}
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
				</svg>
			{/if}
		</span>
		<span class="font-medium">Store</span>
	</button>
</nav>

<!-- Store picker (bottom sheet on mobile, dropdown on desktop) -->
{#if storeSheetOpen}
	<div
		class="fixed inset-0 z-40"
		role="button"
		tabindex="-1"
		onclick={() => closeStoreSwitcher()}
		onkeydown={(e) => e.key === 'Escape' && closeStoreSwitcher()}
	></div>
	<div
		transition:slide={{ duration: 180 }}
		class="fixed bottom-16 inset-x-0 z-50 bg-card/95 backdrop-blur border border-border rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.08)] max-h-[60vh] flex flex-col
			lg:bottom-auto lg:inset-x-auto lg:top-16 lg:right-6 lg:left-auto lg:w-72 lg:rounded-2xl lg:max-h-[70vh]"
	>
		<div class="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
			<span class="text-sm font-semibold text-foreground">Select Store</span>
			<button onclick={() => closeStoreSwitcher()} class="btn-icon text-muted-foreground">
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
						href="/dispatcher/stores/{store.id}/orders"
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150
							{isStoreActive(store.id)
								? 'bg-primary/10 text-primary font-medium'
								: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					>
						{#if store.logoUrl}
							<img src={store.logoUrl} alt="" class="size-7 rounded-md object-contain shrink-0" />
						{:else}
							<div class="size-7 rounded-md bg-current/10 flex items-center justify-center text-xs font-bold shrink-0">
								{store.name[0].toUpperCase()}
							</div>
						{/if}
						<span class="flex-1 truncate">{store.name}</span>
						{#if store.pendingCount > 0}
							<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 shrink-0">
								{store.pendingCount}
							</span>
						{/if}
					</a>
				{/each}
			{/if}
		</div>
		<div class="p-2 border-t border-border shrink-0">
			<button
				onclick={() => { closeStoreSwitcher(); logoutConfirmOpen = true; }}
				class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150"
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
				</svg>
				Logout
			</button>
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
