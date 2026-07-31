<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency, formatRelativeDate, shopifyIdToNumber } from '$lib/utils';
	import { deliveryPill } from '$lib/delivery-status';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const storeId = $derived($page.params.storeId);
	let editing = $state(false);
	let copiedTracking = $state<string | null>(null);
	const customer = $derived(data.customer);

	function deliveryStatusInfo(order: {
		fulfillments: { displayStatus: string | null; trackingInfo: { number: string | null }[] }[];
	}): { label: string; class: string } | null {
		const hasTracking = order.fulfillments.some((f) => f.trackingInfo.some((t) => t.number));
		return deliveryPill(order.fulfillments.find((f) => f.displayStatus)?.displayStatus, hasTracking);
	}
</script>

<svelte:head>
	<title>{customer.displayName} — Customers</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6">
		<div class="flex items-center gap-4">
			<Button href="/dispatcher/stores/{storeId}/orders" variant="outline" size="icon" class="shrink-0" title="Back to Orders">
				<ArrowLeftIcon class="size-4" />
			</Button>
			<div>
				<h1 class="text-2xl font-bold">{customer.displayName}</h1>
				<p class="text-sm text-muted-foreground">{customer.numberOfOrders} order{customer.numberOfOrders !== 1 ? 's' : ''}</p>
			</div>
		</div>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">Customer updated successfully.</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Customer info -->
		<div class="lg:col-span-1 lg:order-2 space-y-4">
			{#if editing}
				<div class="card p-5">
					<div class="flex items-center justify-between mb-4">
						<h2 class="font-semibold">Edit Customer</h2>
						<Button variant="outline" size="sm" onclick={() => editing = false}>Cancel</Button>
					</div>
					<form method="POST" action="?/update" use:enhance class="space-y-3">
						<div class="space-y-1.5">
							<Label class="text-xs">First Name</Label>
							<Input name="firstName" value={customer.firstName ?? ''} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs">Last Name</Label>
							<Input name="lastName" value={customer.lastName ?? ''} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs">Email</Label>
							<Input name="email" type="email" value={customer.email ?? ''} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs">Phone</Label>
							<Input name="phone" type="tel" value={customer.phone ?? ''} />
						</div>
						<Button type="submit" class="w-full">Save</Button>
					</form>
				</div>
			{:else}
				<div class="card p-5">
					<div class="flex items-center justify-between mb-3">
						<h2 class="font-semibold">Contact Info</h2>
						<Button variant="outline" size="sm" onclick={() => editing = true}>
							<PencilIcon class="size-3.5" />
							Edit
						</Button>
					</div>
					<dl class="space-y-3 text-sm">
						{#if customer.email}
							<div>
								<dt class="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Email</dt>
								<dd class="font-medium">{customer.email}</dd>
							</div>
						{/if}
						{#if customer.phone}
							<div>
								<dt class="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Phone</dt>
								<dd class="font-medium">{customer.phone}</dd>
							</div>
						{/if}
						{#if customer.defaultAddress}
							<div>
								<dt class="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Default Address</dt>
								<dd class="text-muted-foreground text-xs">
									{customer.defaultAddress.address1}<br/>
									{customer.defaultAddress.city}, {customer.defaultAddress.country}
								</dd>
							</div>
						{/if}
					</dl>
				</div>
				<div class="card p-5">
					<div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Shopify ID</div>
					<code class="text-xs font-mono text-muted-foreground">{shopifyIdToNumber(customer.id)}</code>
				</div>
			{/if}
		</div>

		<!-- Order history -->
		<div class="lg:col-span-2 lg:order-1">
			<div class="card">
				<div class="card-header pb-3">
					<h2 class="font-semibold">Order History</h2>
				</div>
				{#if customer.orders.nodes.length === 0}
					<div class="card-content text-center py-8">
						<p class="text-sm text-muted-foreground">No orders yet</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-border bg-muted/30">
									<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Order</th>
									<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Date</th>
									<th class="text-center px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Items</th>
									<th class="text-right px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Total</th>
									<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Payment</th>
									<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Fulfillment</th>
									<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Destination</th>
									<th class="text-left px-3 py-2 font-semibold text-foreground/70 text-xs uppercase tracking-wide whitespace-nowrap">Delivery Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border">
								{#each customer.orders.nodes as order}
									{@const delivery = deliveryStatusInfo(order)}
									{@const isCancelled = !!order.cancelledAt}
									<tr class="hover:bg-muted/40 transition-colors {isCancelled ? 'opacity-60 bg-muted/30' : ''}">
										<td class="px-3 py-1.5 font-bold whitespace-nowrap {isCancelled ? 'line-through' : ''}">
											<a href="/dispatcher/stores/{storeId}/orders/{shopifyIdToNumber(order.id)}" class="text-foreground hover:text-primary hover:underline">{order.name}</a>
										</td>
										<td class="px-3 py-1.5 text-foreground/70 whitespace-nowrap {isCancelled ? 'line-through' : ''}">{formatRelativeDate(order.createdAt)}</td>
										<td class="px-3 py-1.5 text-center text-foreground/70" onclick={(e) => e.stopPropagation()}>
											<Popover.Root>
												<Popover.Trigger>
													{#snippet child({ props })}
														<button type="button" {...props} class="inline-flex items-center gap-1 hover:text-primary rounded-md px-1.5 -mx-1.5 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:bg-primary/5 {isCancelled ? 'line-through' : ''}">
															{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)}
															<ChevronDownIcon class="size-3.5" />
														</button>
													{/snippet}
												</Popover.Trigger>
												<Popover.Content class="w-80 p-0 gap-0 overflow-hidden" align="center">
													<div class="divide-y divide-border overflow-y-auto" style="max-height: min(60vh, var(--bits-floating-available-height, 60vh));">
														{#each order.lineItems.nodes as item}
															{@const img = item.variant?.image ?? item.image}
															<div class="flex items-center gap-3 px-3 py-2.5">
																{#if img}
																	<img src={img.url} alt={img.altText ?? item.title} class="size-10 rounded-md object-cover border border-border shrink-0" />
																{:else}
																	<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
																{/if}
																<div class="min-w-0 flex-1">
																	<div class="text-sm font-medium text-foreground leading-snug">{item.title}</div>
																	{#if item.variant?.title && item.variant.title !== 'Default Title'}
																		<span class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">{item.variant.title}</span>
																	{/if}
																</div>
																<span class="text-sm text-muted-foreground shrink-0">×{item.quantity}</span>
															</div>
														{/each}
													</div>
												</Popover.Content>
											</Popover.Root>
										</td>
										<td class="px-3 py-1.5 text-right font-semibold text-foreground whitespace-nowrap {isCancelled ? 'line-through' : ''}">
											{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}
										</td>
										<td class="px-3 py-1.5">
											<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
												{order.displayFinancialStatus === 'PAID' ? 'bg-green-100 text-green-800' :
												 order.displayFinancialStatus === 'PENDING' ? 'bg-amber-100 text-amber-800' :
												 order.displayFinancialStatus === 'REFUNDED' ? 'bg-red-100 text-red-700' :
												 'bg-zinc-100 text-zinc-700'}">
												<span class="size-1.5 rounded-full bg-current shrink-0"></span>
												{order.displayFinancialStatus.replace(/_/g,' ')}
											</span>
										</td>
										<td class="px-3 py-1.5">
											{#if isCancelled}
												<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
													<span class="size-1.5 rounded-full bg-current shrink-0"></span>
													Not required
												</span>
											{:else}
												<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
													{order.displayFulfillmentStatus === 'FULFILLED' ? 'bg-green-100 text-green-800' :
													 order.displayFulfillmentStatus === 'UNFULFILLED' ? 'bg-amber-100 text-amber-800' :
													 'bg-zinc-100 text-zinc-700'}">
													<span class="size-1.5 rounded-full bg-current shrink-0"></span>
													{order.displayFulfillmentStatus.replace(/_/g,' ')}
												</span>
											{/if}
										</td>
										<td class="px-3 py-1.5 whitespace-nowrap {isCancelled ? 'line-through' : ''}">
											{#if order.shippingAddress}
												<div class="font-medium text-foreground">{order.shippingAddress.city}</div>
												<div class="text-xs text-foreground/60">{order.shippingAddress.country}</div>
											{:else}
												<span class="text-foreground/40">—</span>
											{/if}
										</td>
										<td class="px-3 py-1.5 whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
											{#if delivery}
												{@const tracking = order.fulfillments.flatMap((f) => f.trackingInfo).find((t) => t.number || t.company)}
												<Popover.Root>
													<Popover.Trigger>
														{#snippet child({ props })}
															<button type="button" {...props} class="inline-flex items-center gap-1 hover:opacity-80 rounded-md px-1 -mx-1 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:bg-primary/5">
																<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
																	<span class="size-1.5 rounded-full bg-current shrink-0"></span>
																	{delivery.label}
																</span>
																<ChevronDownIcon class="size-3.5 text-muted-foreground" />
															</button>
														{/snippet}
													</Popover.Trigger>
													<Popover.Content class="w-64 p-3" align="end">
														<div class="text-sm font-semibold mb-2">Delivery</div>
														{#if tracking}
															<div class="space-y-2 text-sm">
																<div>
																	<div class="text-xs text-muted-foreground uppercase tracking-wide">Courier</div>
																	<div class="font-medium text-foreground">{tracking.company ?? 'Unknown courier'}</div>
																</div>
																<div>
																	<div class="text-xs text-muted-foreground uppercase tracking-wide">Tracking</div>
																	<div class="flex items-center gap-1.5">
																		{#if tracking.url}
																			<a href={tracking.url} target="_blank" rel="noopener" class="font-mono text-primary hover:underline">
																				{tracking.number ?? tracking.url}
																			</a>
																		{:else}
																			<div class="font-mono text-foreground">{tracking.number ?? '—'}</div>
																		{/if}
																		{#if tracking.number}
																			<button
																				type="button"
																				class="text-muted-foreground hover:text-primary shrink-0"
																				title="Copy tracking number"
																				onclick={() => {
																					const num = tracking.number ?? '';
																					navigator.clipboard.writeText(num);
																					copiedTracking = num;
																					setTimeout(() => copiedTracking === num && (copiedTracking = null), 1200);
																				}}
																			>
																				{#if copiedTracking === tracking.number}
																					<CheckIcon class="size-3.5 text-green-600" />
																				{:else}
																					<CopyIcon class="size-3.5" />
																				{/if}
																			</button>
																		{/if}
																	</div>
																</div>
															</div>
														{:else}
															<p class="text-sm text-muted-foreground">No tracking information yet.</p>
														{/if}
													</Popover.Content>
												</Popover.Root>
											{:else}
												<span class="text-foreground/40">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
