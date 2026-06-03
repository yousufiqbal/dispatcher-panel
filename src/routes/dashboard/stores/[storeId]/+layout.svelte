<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const navItems = [
		{ href: 'orders', label: 'Orders' },
		{ href: 'customers', label: 'Customers' }
	];

	function isTabActive(tab: string) {
		return $page.url.pathname.includes(`/${tab}`);
	}
</script>

<div class="flex flex-col h-full">
	<div class="bg-card border-b border-border px-6 py-4 flex items-center gap-4 shadow-sm">
		<div class="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
			{data.currentStore.nickname[0].toUpperCase()}
		</div>
		<div class="flex-1 min-w-0">
			<h1 class="font-semibold text-foreground">{data.currentStore.nickname}</h1>
			<p class="text-xs text-muted-foreground">{data.currentStore.shopifyDomain}</p>
		</div>
		<div class="flex items-center gap-1">
			{#each navItems as item}
				<a
					href="/dashboard/stores/{data.currentStore.id}/{item.href}"
					class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150
						{isTabActive(item.href)
							? 'bg-primary/10 text-primary'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					{item.label}
				</a>
			{/each}
		</div>
	</div>

	<div class="flex-1 overflow-auto">
		{@render children()}
	</div>
</div>
