<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let mobileOpen = $state(false);

	const navItems = [
		{ href: '/admin', label: 'Overview', icon: 'home' },
		{ href: '/admin/dispatchers', label: 'Dispatchers', icon: 'users' },
		{ href: '/admin/stores', label: 'Stores', icon: 'store' },
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

	$effect(() => {
		$page.url.pathname;
		mobileOpen = false;
	});
</script>

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
		fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border w-60 shadow-sm
		transition-transform duration-200
		{mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
	">
		<div class="flex items-center gap-3 px-5 py-4 border-b border-border">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold">D</div>
			<div class="flex-1 min-w-0">
				<div class="text-sm font-semibold text-foreground">Dispatcher Panel</div>
				<div class="text-xs text-muted-foreground">Admin</div>
			</div>
			<button class="lg:hidden btn-icon text-muted-foreground" onclick={() => mobileOpen = false}>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
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
					{#if item.icon === 'home'}
						<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
					{:else if item.icon === 'users'}
						<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
					{:else if item.icon === 'store'}
						<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
					{:else if item.icon === 'settings'}
						<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" /></svg>
					{:else}
						<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
					{/if}
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
				<button onclick={logout} title="Sign out" class="btn-icon text-muted-foreground hover:text-foreground">
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
				</button>
			</div>
		</div>
	</aside>

	<!-- Main -->
	<div class="flex-1 flex flex-col min-h-screen lg:ml-60">
		<!-- Mobile top bar -->
		<div class="lg:hidden flex items-center gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
			<button onclick={() => mobileOpen = true} class="btn-icon text-muted-foreground">
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<span class="text-sm font-semibold">Admin Panel</span>
		</div>

		<main class="flex-1">
			{@render children()}
		</main>
	</div>
</div>
