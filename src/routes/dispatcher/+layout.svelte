<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { isStoreSwitcherOpen, openStoreSwitcher, closeStoreSwitcher } from '$lib/storeSwitcher.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const storeSheetOpen = $derived(isStoreSwitcherOpen());
	let logoutConfirmOpen = $state(false);
	let switcherPanelEl = $state<HTMLDivElement | null>(null);
	let mobileNavOpen = $state(false);

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
		return $page.url.pathname.includes(`/${sub}/`) || $page.url.pathname.endsWith(`/${sub}`);
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}

	// close store switcher + mobile drawer on navigation
	$effect(() => {
		$page.url.pathname;
		closeStoreSwitcher();
		mobileNavOpen = false;
	});

	// Click-outside-to-close, driven directly off the panel element rather than a
	// full-screen overlay — the overlay approach silently failed to close because
	// the sidebar (z-50) painted above it (z-40) over the exact region the panel
	// occupies, swallowing the click before it ever reached the overlay.
	$effect(() => {
		if (!storeSheetOpen) return;
		function onDocClick(e: MouseEvent) {
			const target = e.target as Node;
			if (switcherPanelEl?.contains(target)) return;
			if ((target as HTMLElement).closest?.('[data-store-switcher-trigger]')) return;
			closeStoreSwitcher();
		}
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
</script>

{#snippet storeList()}
	{#if data.assignedStores.length === 0}
		<p class="px-2.5 py-1.5 text-xs text-muted-foreground">No stores assigned</p>
	{:else}
		{#each data.assignedStores as store}
			<a
				href="/dispatcher/stores/{store.id}/orders"
				class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors duration-150
					{isStoreActive(store.id)
						? 'bg-primary/10 text-primary font-medium'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
			>
				{#if store.logoUrl}
					<img src={store.logoUrl} alt="" class="size-6 rounded-md object-contain shrink-0" />
				{:else}
					<div class="size-6 rounded-md bg-current/10 flex items-center justify-center text-xs font-bold shrink-0">
						{store.name[0].toUpperCase()}
					</div>
				{/if}
				<span class="flex-1 truncate">{store.name}</span>
				{#if store.pendingCount > 0}
					<span class="inline-flex items-center justify-center min-w-[1.125rem] h-4.5 px-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 shrink-0">
						{store.pendingCount}
					</span>
				{/if}
			</a>
		{/each}
	{/if}
	<div class="pt-1 mt-1 border-t border-border">
		<button
			onclick={() => { closeStoreSwitcher(); logoutConfirmOpen = true; }}
			class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
		>
			<LogOutIcon class="size-4" />
			Logout
		</button>
	</div>
{/snippet}

{#snippet navLinks()}
	{#each [
		{ href: 'orders', label: 'Orders', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
		{ href: 'customers', label: 'Customers', d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
		{ href: 'products', label: 'Products', d: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
		{ href: 'inventory', label: 'Inventory', d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7' },
		{ href: 'restock', label: 'Restock', d: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99' },
		{ href: 'inventory-count', label: 'Inventory Count', d: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' }
	] as item}
		<a
			href={tabHref(item.href)}
			class="flex items-center gap-3 mx-1 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150
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
{/snippet}

<div class="min-h-screen bg-zinc-50 flex">
	<!-- Sidebar — fixed on desktop, slide-in drawer on mobile -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border w-64 shadow-sm transition-transform duration-200
			{mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0"
	>
		<!-- Store selector -->
		<div class="relative shrink-0">
			<button
				data-store-switcher-trigger
				onclick={() => storeSheetOpen ? closeStoreSwitcher() : openStoreSwitcher()}
				class="flex items-center gap-3 px-5 h-[73px] bg-card shadow-sm w-full text-left transition-colors duration-150
					{storeSheetOpen ? 'bg-accent' : 'hover:bg-accent'}"
			>
				{#if currentStoreLogo}
					<img src={currentStoreLogo} alt="" class="size-8 rounded-lg object-contain shrink-0 border border-border" />
				{:else}
					<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">
						{currentStoreName ? currentStoreName[0].toUpperCase() : 'PS'}
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="text-sm font-semibold text-foreground truncate">{currentStoreName ?? 'Select store'}</div>
					<div class="text-xs text-muted-foreground truncate">Dispatcher Panel</div>
				</div>
				<svg class="size-4 text-muted-foreground shrink-0 transition-transform duration-150 {storeSheetOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
				</svg>
			</button>

			{#if storeSheetOpen}
				<div
					bind:this={switcherPanelEl}
					transition:slide={{ duration: 150 }}
					class="absolute top-full left-2 right-2 z-50 mt-1.5 bg-card border border-border rounded-xl shadow-lg p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto"
				>
					{@render storeList()}
				</div>
			{/if}
		</div>

		<!-- Section links -->
		<nav class="flex-1 p-2 pt-3 space-y-0.5 overflow-y-auto">
			{@render navLinks()}
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
				<Button onclick={() => logoutConfirmOpen = true} title="Sign out" variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground shrink-0">
					<LogOutIcon class="size-4" />
				</Button>
			</div>
		</div>
	</aside>

	<!-- Backdrop for mobile drawer -->
	{#if mobileNavOpen}
		<div
			class="lg:hidden fixed inset-0 z-40 bg-black/40"
			role="button"
			tabindex="-1"
			onclick={() => mobileNavOpen = false}
			onkeydown={(e) => e.key === 'Escape' && (mobileNavOpen = false)}
		></div>
	{/if}

	<!-- Main -->
	<div class="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-64">
		<!-- Mobile top bar with hamburger -->
		<div class="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-3 h-14 bg-card border-b border-border shadow-sm">
			<Button onclick={() => mobileNavOpen = true} variant="ghost" size="icon" title="Open menu">
				<MenuIcon class="size-5" />
			</Button>
			<div class="flex items-center gap-2 min-w-0">
				{#if currentStoreLogo}
					<img src={currentStoreLogo} alt="" class="size-6 rounded-md object-contain shrink-0 border border-border" />
				{/if}
				<span class="text-sm font-semibold text-foreground truncate">{currentStoreName ?? 'Pro Shipper'}</span>
			</div>
		</div>

		<main class="flex-1">
			{#key $page.url.pathname}
				{@render children()}
			{/key}
		</main>
	</div>
</div>

<!-- Logout confirm modal -->
<Dialog.Root bind:open={logoutConfirmOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Sign out?</Dialog.Title>
			<Dialog.Description>You'll need to log in again to access the panel.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => logoutConfirmOpen = false}>Cancel</Button>
			<Button variant="destructive" onclick={logout}>Sign Out</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
