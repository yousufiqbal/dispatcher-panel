<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let logoutConfirmOpen = $state(false);
	let mobileMoreOpen = $state(false);

	// `data` can transiently be null if a load lower in the tree throws (e.g. a
	// blip talking to the DB/Shopify during a fast Next/Previous navigation) —
	// SvelteKit still renders this layout around the error boundary in that case.
	const store = $derived(data?.store ?? null);
	const isOwner = $derived(!!data?.dispatcher?.isOwner);

	function isActive(href: string) {
		const path = $page.url.pathname;
		return path === href || path.startsWith(`${href}/`);
	}

	const NAV_ITEMS = [
		{ href: '/confirmer', label: 'Confirmer', d: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
		{ href: '/tracker', label: 'Tracker', d: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12' },
		{ href: '/products', label: 'Products', d: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
		{ href: '/inventory-count', label: 'Audit', d: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
		{ href: '/weights', label: 'Weights', d: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z' }
	];

	// Owner-only pages. Not tied to a store, so they link directly.
	const OWNER_ITEMS = [
		{ href: '/team', label: 'Team', d: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
		{ href: '/activity', label: 'Activity', d: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' }
	];
	// Mobile: the first five sections sit in the bottom bar; the rest (and the
	// owner pages) live under "More".
	const bottomBarItems = NAV_ITEMS.slice(0, 5);
	const moreNavItems = NAV_ITEMS.slice(5);
	const moreActive = $derived(
		moreNavItems.some((i) => isActive(i.href)) || (isOwner && OWNER_ITEMS.some((i) => isActive(i.href)))
	);

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}

	// Close the mobile "More" dropup on navigation.
	$effect(() => {
		$page.url.pathname;
		mobileMoreOpen = false;
	});
</script>

{#snippet link(item: { href: string; label: string; d: string }, disabled: boolean)}
	<a
		href={item.href}
		class="flex items-center gap-3 mx-1 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150
			{disabled ? 'pointer-events-none opacity-40' : ''}
			{isActive(item.href)
				? 'bg-primary/10 text-primary font-medium'
				: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
	>
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d={item.d} />
		</svg>
		<span class="flex-1">{item.label}</span>
		{#if item.href === '/confirmer' && store && store.pendingCount > 0}
			<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-warning-soft text-warning">
				{store.pendingCount}
			</span>
		{/if}
	</a>
{/snippet}

{#snippet navLinks()}
	<!-- Store pages are greyed out until Shopify is configured. -->
	{#each NAV_ITEMS as item (item.href)}
		{@render link(item, !store)}
	{/each}
{/snippet}

{#snippet ownerLinks()}
	{#if isOwner}
		<div class="mx-4 mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Owner</div>
		{#each OWNER_ITEMS as item (item.href)}
			{@render link(item, false)}
		{/each}
	{/if}
{/snippet}

<div class="min-h-screen bg-background flex">
	<!-- Sidebar — desktop only; mobile navigation is the bottom bar below -->
	<aside class="hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col bg-card border-r border-border w-56 shadow-sm">
		<div class="flex items-center gap-3 px-5 h-[73px] border-b border-border shrink-0">
			{#if store?.logoUrl}
				<img src={store.logoUrl} alt="" class="size-8 rounded-lg object-contain shrink-0 border border-border" />
			{:else}
				<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">
					{store?.name?.[0]?.toUpperCase() ?? 'D'}
				</div>
			{/if}
			<div class="flex-1 min-w-0">
				<div class="text-sm font-semibold text-foreground truncate">{store?.name ?? 'Not connected'}</div>
				<div class="text-xs text-muted-foreground truncate">Dispatcher Panel</div>
			</div>
		</div>

		<nav class="flex-1 p-2 pt-3 space-y-0.5 overflow-y-auto">
			{@render navLinks()}
			{@render ownerLinks()}
		</nav>

		<div class="p-2 border-t border-border">
			<div class="flex items-center gap-3 px-3 py-2 rounded-lg">
				<div class="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
					{data?.dispatcher?.name?.[0]?.toUpperCase() ?? 'D'}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-xs font-medium text-foreground truncate">{data?.dispatcher?.name}</div>
					<div class="text-xs text-muted-foreground truncate">{data?.dispatcher?.email}</div>
				</div>
				<Button onclick={() => (logoutConfirmOpen = true)} title="Sign out" variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground shrink-0">
					<LogOutIcon class="size-4" />
				</Button>
			</div>
		</div>
	</aside>

	<div class="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-56">
		<main class="flex-1 pb-16 lg:pb-0">
			{#key $page.url.pathname}
				{@render children()}
			{/key}
		</main>
	</div>

	<!-- Mobile bottom bar: first five sections + "More" -->
	<nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch h-16 bg-card border-t border-border shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
		{#each bottomBarItems as item (item.href)}
			<a
				href={item.href}
				class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors duration-150
					{!store ? 'pointer-events-none opacity-40' : ''}
					{isActive(item.href) ? 'text-primary font-medium' : 'text-muted-foreground'}"
			>
				<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d={item.d} />
				</svg>
				{item.label}
			</a>
		{/each}
		<button
			onclick={() => (mobileMoreOpen = !mobileMoreOpen)}
			class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors duration-150
				{mobileMoreOpen || moreActive ? 'text-primary font-medium' : 'text-muted-foreground'}"
		>
			<MoreHorizontalIcon class="size-5 shrink-0" />
			More
		</button>
	</nav>

	<!-- Mobile "More" dropup: remaining sections, owner pages, sign out -->
	{#if mobileMoreOpen}
		<div
			class="lg:hidden fixed inset-0 z-40 bg-black/40"
			role="button"
			tabindex="-1"
			onclick={() => (mobileMoreOpen = false)}
			onkeydown={(e) => e.key === 'Escape' && (mobileMoreOpen = false)}
		></div>
		<div
			transition:slide={{ duration: 150 }}
			class="lg:hidden fixed bottom-16 left-2 right-2 z-50 bg-card border border-border rounded-xl shadow-lg p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto"
		>
			{#each moreNavItems as item (item.href)}
				{@render link(item, !store)}
			{/each}
			{@render ownerLinks()}
			<div class="border-t border-border my-1"></div>
			<button
				onclick={() => { mobileMoreOpen = false; logoutConfirmOpen = true; }}
				class="w-full flex items-center gap-3 mx-1 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150"
			>
				<LogOutIcon class="size-5" />
				Sign out
			</button>
		</div>
	{/if}
</div>

<Dialog.Root bind:open={logoutConfirmOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Sign out?</Dialog.Title>
			<Dialog.Description>You'll need to log in again to access the panel.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (logoutConfirmOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={logout}>Sign Out</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
