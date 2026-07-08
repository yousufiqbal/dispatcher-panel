<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const periods = [
		{ key: 'today', label: 'Today' },
		{ key: '7d', label: '7 Days' },
		{ key: '30d', label: '30 Days' },
		{ key: '365d', label: '365 Days' },
		{ key: 'all', label: 'All' }
	];

	function applyFilters(period: string, courierId: string, status: string) {
		const sp = new URLSearchParams();
		if (period) sp.set('period', period);
		if (courierId) sp.set('courierId', courierId);
		if (status) sp.set('status', status);
		goto(`?${sp}`, { keepFocus: true });
	}
</script>

<svelte:head>
	<title>Bookings — {data.currentStore?.name ?? 'Store'}</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<p class="text-sm text-muted-foreground mb-5">{data.bookings.length} booking{data.bookings.length !== 1 ? 's' : ''}</p>

	<!-- Courier tabs -->
	<div class="mb-3">
		<Tabs.Root value={data.courierId} onValueChange={(v) => applyFilters(data.period, v, data.status)}>
			<Tabs.List class="h-auto flex-wrap">
				{#each data.couriers as c}
					<Tabs.Trigger value={c.id}>{c.name}</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</Tabs.Root>
	</div>

	<!-- Period tabs -->
	<div class="mb-3">
		<Tabs.Root value={data.period} onValueChange={(v) => applyFilters(v, data.courierId, data.status)}>
			<Tabs.List class="h-auto flex-wrap">
				{#each periods as p}
					<Tabs.Trigger value={p.key}>{p.label}</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</Tabs.Root>
	</div>

	<!-- Status tabs -->
	{#if data.statuses.length > 0}
		<div class="mb-5">
			<Tabs.Root value={data.status} onValueChange={(v) => applyFilters(data.period, data.courierId, v)}>
				<Tabs.List class="h-auto flex-wrap">
					<Tabs.Trigger value="">All Statuses</Tabs.Trigger>
					{#each data.statuses as s}
						<Tabs.Trigger value={s}>{s}</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</Tabs.Root>
		</div>
	{/if}

	{#if data.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{data.error}</div>
	{:else if data.bookings.length === 0}
		<div class="card p-12 text-center">
			<h3 class="font-semibold text-foreground mb-1">No bookings found</h3>
			<p class="text-sm text-muted-foreground">Try a different period or courier filter.</p>
		</div>
	{:else}
		<!-- Desktop: table -->
		<div class="card overflow-hidden hidden sm:block">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/30">
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">Courier</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">Tracking ID</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">COD</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">City</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground">Note</th>
							<th class="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Booked At</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.bookings as b}
							<tr class="hover:bg-muted/20">
								<td class="px-4 py-3 font-medium text-foreground whitespace-nowrap">{b.orderName}</td>
								<td class="px-4 py-3 whitespace-nowrap">{b.courierName}</td>
								<td class="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{b.trackingId}</td>
								<td class="px-4 py-3 whitespace-nowrap">{b.codAmount ?? '—'}</td>
								<td class="px-4 py-3 whitespace-nowrap">{b.city ?? '—'}</td>
								<td class="px-4 py-3 whitespace-nowrap">{b.status ?? '—'}</td>
								<td class="px-4 py-3 text-muted-foreground">{b.note ?? '—'}</td>
								<td class="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(b.createdAt.toISOString())}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile: cards -->
		<div class="space-y-3 sm:hidden">
			{#each data.bookings as b}
				<div class="card p-4">
					<div class="flex items-center justify-between mb-1">
						<span class="font-semibold text-sm text-foreground">{b.orderName}</span>
						<span class="text-xs text-muted-foreground">{b.courierName}</span>
					</div>
					<div class="text-xs font-mono text-muted-foreground mb-2">{b.trackingId}</div>
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>COD: {b.codAmount ?? '—'} · {b.city ?? '—'}{b.status ? ` · ${b.status}` : ''}</span>
						<span>{formatDate(b.createdAt.toISOString())}</span>
					</div>
					{#if b.note}
						<div class="text-xs text-muted-foreground mt-1">{b.note}</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
