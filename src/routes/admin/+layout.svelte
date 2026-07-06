<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { isLogoutConfirmOpen, openLogoutConfirm, closeLogoutConfirm } from '$lib/adminLogoutConfirm.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const logoutConfirmOpen = $derived(isLogoutConfirmOpen());

	const navItems = [
		{ href: '/admin', label: 'Overview', icon: 'home' },
		{ href: '/admin/dispatchers', label: 'Dispatchers', icon: 'users' },
		{ href: '/admin/stores', label: 'Stores', icon: 'store' },
		{ href: '/admin/couriers', label: 'Couriers', icon: 'truck' },
		{ href: '/admin/audit', label: 'Audit Log', icon: 'log' },
		{ href: '/admin/settings', label: 'Settings', icon: 'settings' }
	];

	function isActive(href: string) {
		if (href === '/admin') return $page.url.pathname === '/admin';
		return $page.url.pathname.startsWith(href);
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}
</script>

{#snippet navIcon(icon: string)}
	{#if icon === 'home'}
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
	{:else if icon === 'users'}
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
	{:else if icon === 'store'}
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
	{:else if icon === 'truck'}
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
	{:else if icon === 'settings'}
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" /></svg>
	{:else}
		<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
	{/if}
{/snippet}

<div class="min-h-screen bg-zinc-50 flex">
	<!-- Sidebar (desktop only) -->
	<aside class="fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col bg-card border-r border-border w-60 shadow-sm">
		<div class="flex items-center gap-3 px-5 py-4 border-b border-border">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold">PS</div>
			<div class="flex-1 min-w-0">
				<div class="text-sm font-semibold text-foreground">Pro Shipper</div>
				<div class="text-xs text-muted-foreground">Admin</div>
			</div>
		</div>

		<nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150
						{isActive(item.href)
							? 'bg-primary/10 text-primary font-medium'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				>
					{@render navIcon(item.icon)}
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="p-3 border-t border-border">
			<div class="flex items-center gap-3 px-3 py-2 rounded-lg">
				<div class="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
					{data.admin?.email?.[0]?.toUpperCase() ?? 'A'}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-xs font-medium text-foreground truncate">{data.admin?.email}</div>
					<div class="text-xs text-muted-foreground">Administrator</div>
				</div>
				<button onclick={() => openLogoutConfirm()} title="Sign out" class="btn-icon text-muted-foreground hover:text-foreground">
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
				</button>
			</div>
		</div>
	</aside>

	<!-- Main -->
	<div class="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-60">
		<main class="flex-1 pb-16 lg:pb-0">
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile bottom nav -->
<nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex h-16 pb-[env(safe-area-inset-bottom)]">
	{#each navItems.filter((i) => i.href !== '/admin') as item}
		<a
			href={item.href}
			class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
				{isActive(item.href) ? 'text-primary' : 'text-muted-foreground'}"
		>
			<span class="flex items-center justify-center size-8 rounded-full {isActive(item.href) ? 'bg-primary/10' : ''}">
				{@render navIcon(item.icon)}
			</span>
			<span class="font-medium">{item.label}</span>
		</a>
	{/each}
</nav>

<!-- Logout confirm modal -->
{#if logoutConfirmOpen}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-sm shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Sign out?</h2>
				<p class="text-sm text-muted-foreground">You'll need to log in again to access the admin panel.</p>
			</div>
			<div class="card-content flex gap-3">
				<button class="btn-destructive" onclick={logout}>Sign Out</button>
				<button class="btn-secondary" onclick={() => closeLogoutConfirm()}>Cancel</button>
			</div>
		</div>
	</div>
{/if}
