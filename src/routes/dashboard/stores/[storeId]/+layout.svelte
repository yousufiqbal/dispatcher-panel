<script lang="ts">
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import { openStoreSwitcher } from '$lib/storeSwitcher.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const sectionLabels: Record<string, string> = {
		orders: 'Orders',
		customers: 'Customers',
		products: 'Products',
		inventory: 'Inventory',
		'draft-orders': 'Draft Orders'
	};

	const currentSection = $derived.by(() => {
		const segments = $page.url.pathname.split('/').filter(Boolean);
		const idx = segments.indexOf(data.currentStore.id);
		return segments[idx + 1] ?? '';
	});

	const sectionLabel = $derived(
		sectionLabels[currentSection] ?? (currentSection.charAt(0).toUpperCase() + currentSection.slice(1))
	);

	// Polling instead of realtime: Shopify has no order webhooks wired up here,
	// so we just ask "anything new since X?" every 30s and fire a real OS/phone
	// notification via the Notification API (works while this tab/PWA is open —
	// true background push would need a service worker + push server).
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
		if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
			Notification.requestPermission();
		}
		const interval = setInterval(pollNewOrders, POLL_MS);
		return () => clearInterval(interval);
	});
</script>

<div class="flex flex-col h-full">
	<!-- Page heading (desktop only — mobile uses bottom nav) -->
	<div class="hidden md:flex items-center justify-between px-6 h-[73px] bg-card border-b border-border shadow-sm">
		<div>
			<h1 class="font-semibold text-foreground text-lg">{sectionLabel}</h1>
			<p class="text-xs text-muted-foreground">{data.currentStore.name}</p>
		</div>
		<button
			onclick={() => openStoreSwitcher()}
			class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-muted/60 hover:bg-muted transition-colors duration-150"
			title="Switch store"
		>
			{#if data.currentStore.logoUrl}
				<img src={data.currentStore.logoUrl} alt="" class="size-6 rounded-md object-contain shrink-0 border border-border/60 bg-white" />
			{:else}
				<div class="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
					{data.currentStore.name[0].toUpperCase()}
				</div>
			{/if}
			<span class="font-medium text-foreground">{data.currentStore.name}</span>
			<svg class="size-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
			</svg>
		</button>
	</div>

	<div class="flex-1 overflow-auto min-w-0">
		{@render children()}
	</div>
</div>
