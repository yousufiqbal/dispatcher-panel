<script lang="ts">
	import { page } from '$app/stores';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	const storeId = $derived($page.params.storeId);

	const navItems = [
		{ href: '', label: 'Income Statement' },
		{ href: '/purchases', label: 'Purchases' },
		{ href: '/damages', label: 'Damages' },
		{ href: '/expenses', label: 'Operating Expenses' }
	];

	function isActive(href: string) {
		const full = `/accounting/stores/${storeId}${href}`;
		return href === '' ? $page.url.pathname === full : $page.url.pathname.startsWith(full);
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-4">
	<a href="/accounting" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-3 w-fit">
		<ArrowLeftIcon class="size-4" />
		Stores
	</a>
	<h1 class="text-lg font-bold text-foreground mb-3">{data.storeName}</h1>

	<nav class="flex gap-1 border-b border-border mb-6 overflow-x-auto">
		{#each navItems as item}
			<a
				href="/accounting/stores/{storeId}{item.href}"
				class="px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors
					{isActive(item.href) ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{item.label}
			</a>
		{/each}
	</nav>

	{@render children()}
</div>
