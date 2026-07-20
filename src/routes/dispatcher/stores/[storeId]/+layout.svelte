<script lang="ts">
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import { subscribeToPush } from '$lib/push-client';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const sectionLabels: Record<string, string> = {
		orders: 'Orders',
		customers: 'Customers',
		products: 'Products',
		inventory: 'Inventory',
		restock: 'Restock',
		'inventory-count': 'Inventory Count',
		'draft-orders': 'Draft Orders',
		booking: 'Booking'
	};

	const currentSection = $derived.by(() => {
		const segments = $page.url.pathname.split('/').filter(Boolean);
		const idx = segments.indexOf(data.currentStore.id);
		if (segments[idx + 1] === 'orders' && segments[idx + 2] === 'book') return 'booking';
		return segments[idx + 1] ?? '';
	});

	const sectionLabel = $derived(
		sectionLabels[currentSection] ?? (currentSection.charAt(0).toUpperCase() + currentSection.slice(1))
	);

	// Same paths as the sidebar nav icons, so the page-heading icon always matches.
	const sectionIconPaths: Record<string, string> = {
		orders: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
		customers: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
		products: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
		inventory: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7',
		restock: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
		'inventory-count': 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
		'draft-orders': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
		booking: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
	};
	const sectionIconPath = $derived(sectionIconPaths[currentSection] ?? sectionIconPaths.orders);

	// Not relevant on these sections — they don't search orders/products/customers.
	const showGlobalSearch = $derived(currentSection !== 'restock' && currentSection !== 'inventory-count');

	// Real push (service worker + web-push, triggered by the Shopify orders/create
	// webhook) delivers notifications even when the tab/app is closed — see
	// subscribeToPush() below. This poll is just an in-tab fallback/toast for
	// when push isn't set up (e.g. no public HTTPS URL configured in dev).
	const POLL_MS = 30_000;
	let lastCheckedAt = new Date().toISOString();

	async function pollNewOrders() {
		try {
			const res = await fetch(`/api/shopify/${data.currentStore.id}/new-orders?since=${encodeURIComponent(lastCheckedAt)}`);
			if (!res.ok) return;
			const body = await res.json();
			for (const order of body.orders) {
				if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
					new Notification(`New order ${order.name}`, {
						body: `${order.customerName} — ${order.total} ${order.currency}`,
						tag: order.id
					});
				} else {
					addToast(`New order ${order.name}`);
				}
			}
			lastCheckedAt = new Date().toISOString();
		} catch {
			// silent — next poll retries
		}
	}

	$effect(() => {
		subscribeToPush();
		const interval = setInterval(pollNewOrders, POLL_MS);
		return () => clearInterval(interval);
	});
</script>

<div class="flex flex-col h-full">
	<!-- Page heading + global search (desktop only — mobile has its own top bar with hamburger) -->
	<div class="hidden md:flex items-center justify-between gap-4 px-6 pt-5 pb-3">
		<div class="flex items-center gap-3 shrink-0">
			<div class="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d={sectionIconPath} />
				</svg>
			</div>
			<div>
				<h1 class="font-bold text-foreground text-lg leading-tight">{sectionLabel}</h1>
				<p class="text-xs text-muted-foreground leading-tight">{data.currentStore.name}</p>
			</div>
		</div>
		{#if showGlobalSearch}
			<GlobalSearch />
		{/if}
	</div>
	{#if showGlobalSearch}
		<!-- Mobile: search only, section identity lives in the top bar -->
		<div class="md:hidden px-3 pt-3">
			<GlobalSearch />
		</div>
	{/if}

	<div class="flex-1 overflow-auto min-w-0">
		{@render children()}
	</div>
</div>
