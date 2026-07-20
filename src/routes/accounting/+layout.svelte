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
		return $page.url.pathname.includes(`/accounting/stores/${storeId}`);
	}

	const currentStoreId = $derived($page.params.storeId as string | undefined);
	const assignedStores = $derived(data?.assignedStores ?? []);
	const currentStore = $derived(assignedStores.find((s) => s.id === currentStoreId));
	const currentStoreName = $derived(currentStore?.name);
	const currentStoreLogo = $derived(currentStore?.logoUrl ?? null);

	function tabHref(sub: string) {
		if (!currentStoreId) return undefined;
		return sub ? `/accounting/stores/${currentStoreId}/${sub}` : `/accounting/stores/${currentStoreId}`;
	}

	function isTabActive(sub: string) {
		const base = `/accounting/stores/${currentStoreId}`;
		return sub ? $page.url.pathname.startsWith(`${base}/${sub}`) : $page.url.pathname === base;
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
	// full-screen overlay — see dispatcher/+layout.svelte for why.
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
	{#if assignedStores.length === 0}
		<p class="px-2.5 py-1.5 text-xs text-muted-foreground">No stores assigned</p>
	{:else}
		{#each assignedStores as store}
			<a
				href="/accounting/stores/{store.id}"
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
		{ href: '', label: 'Income Statement', d: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
		{ href: 'purchases', label: 'Purchases', d: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.98-4.804 2.545-7.454a1.125 1.125 0 00-1.11-1.36H5.055M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' },
		{ href: 'damages', label: 'Damages', d: 'M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 9v3.75m0 3.75h.007v.008H12v-.008z' },
		{ href: 'expenses', label: 'Operating Expenses', d: 'M12 6v1.5m0 9V18m3-8.25c0-1.036-1.343-1.875-3-1.875s-3 .84-3 1.875 1.343 1.875 3 1.875 3 .84 3 1.875-1.343 1.875-3 1.875-3-.84-3-1.875M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z' }
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
					<div class="text-xs text-muted-foreground truncate">Accounting Panel</div>
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
					{data?.accountant?.name?.[0]?.toUpperCase() ?? 'A'}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-xs font-medium text-foreground truncate">{data?.accountant?.name}</div>
					<div class="text-xs text-muted-foreground truncate">{data?.accountant?.email}</div>
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
