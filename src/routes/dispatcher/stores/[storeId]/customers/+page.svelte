<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const storeId = $derived($page.params.storeId);
	let loadingMore = $state(false);
	let compact = $state(true);

	$effect(() => {
		data;
		loadingMore = false;
	});

	function nextPage() {
		loadingMore = true;
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('after', data.pageInfo.endCursor);
		goto(`?${sp}`, { keepFocus: true });
	}
</script>

<svelte:head>
	<title>Customers — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="flex items-center justify-between gap-4 mb-5">
		<GlobalSearch />
		<div class="flex items-center gap-2 shrink-0">
			<Button href="/dispatcher/stores/{storeId}/customers/new" class="shrink-0 size-9 p-0 sm:size-auto sm:px-4 sm:py-2">
				<UserPlusIcon class="size-4" />
				<span class="hidden sm:inline">New Customer</span>
			</Button>
			<Button
				onclick={() => compact = !compact}
				variant="outline"
				size="icon"
				class="hidden lg:inline-flex"
				title={compact ? 'Expand to full width' : 'Compact width'}
			>
				{#if compact}
					<Minimize2Icon class="size-4" />
				{:else}
					<Maximize2Icon class="size-4" />
				{/if}
			</Button>
		</div>
	</div>

	{#if data.customers.length === 0}
		<div class="card p-12 text-center">
			<svg class="size-12 mx-auto text-muted-foreground/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
			</svg>
			<h3 class="font-semibold text-foreground mb-1">No customers found</h3>
		</div>
	{:else}
		<div class="card overflow-hidden {compact ? 'lg:max-w-[50%]' : ''}">
			<div class="divide-y divide-border">
				{#each data.customers as customer}
					<a
						href="/dispatcher/stores/{storeId}/customers/{customer.id.split('/').pop()}"
						class="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
					>
						<div class="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
							{customer.displayName[0]?.toUpperCase() ?? '?'}
						</div>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm text-foreground">{customer.displayName}</div>
							<div class="text-xs text-muted-foreground">{customer.email ?? ''}{customer.email && customer.phone ? ' · ' : ''}{customer.phone ?? ''}</div>
						</div>
						<div class="text-xs text-muted-foreground">{customer.numberOfOrders} order{customer.numberOfOrders !== 1 ? 's' : ''}</div>
						<ChevronRightIcon class="size-4 text-muted-foreground shrink-0" />
					</a>
				{/each}
			</div>

			{#if data.pageInfo.hasNextPage}
				<div class="flex justify-center p-4 border-t border-border">
					<Button variant="outline" disabled={loadingMore} onclick={nextPage}>
						{#if loadingMore}
							<Loader2Icon class="size-4 animate-spin" />
						{/if}
						{loadingMore ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>
