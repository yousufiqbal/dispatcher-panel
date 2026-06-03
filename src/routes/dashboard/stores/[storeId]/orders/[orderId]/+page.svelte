<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency, formatDate, shopifyIdToNumber } from '$lib/utils';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');
	let showMoreMenu = $state(false);
	let showCancelDialog = $state(false);
	let showFulfillDialog = $state(false);
	let showRefundDialog = $state(false);
	let editShipping = $state(false);

	const order = $derived(data.order);
	const storeId = $derived($page.params.storeId);

	const isCancelled = $derived(
		order.displayFinancialStatus === 'VOIDED' || order.displayFinancialStatus === 'REFUNDED'
	);
	const isFulfilled = $derived(order.displayFulfillmentStatus === 'FULFILLED');

	function statusClass(financial: string, fulfillment: string) {
		if (financial === 'REFUNDED' || financial === 'VOIDED') return 'badge-cancelled';
		if (fulfillment === 'FULFILLED') return 'badge-fulfilled';
		if (financial === 'PENDING') return 'badge-pending';
		return 'badge-partial';
	}
</script>

<svelte:head>
	<title>Order {order.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 space-y-4">

	<!-- Header -->
	<div class="flex items-start justify-between gap-4 flex-wrap">
		<div>
			<a href="/dashboard/stores/{storeId}/orders" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3 w-fit">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
				Orders
			</a>
			<div class="flex items-center gap-3 flex-wrap">
				<h1 class="text-2xl font-bold">{order.name}</h1>
				<span class="badge-partial">{order.displayFinancialStatus.replace(/_/g,' ')}</span>
				<span class="{statusClass(order.displayFinancialStatus, order.displayFulfillmentStatus)}">{order.displayFulfillmentStatus.replace(/_/g,' ')}</span>
			</div>
			<p class="text-sm text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
		</div>

		{#if !isCancelled}
			<div class="flex items-center gap-2">
				<a href="/dashboard/stores/{storeId}/orders/{$page.params.orderId}/edit" class="btn-secondary">Edit</a>
				{#if !isFulfilled}
					<button class="btn-primary" onclick={() => showFulfillDialog = true}>Fulfill Order</button>
				{/if}
				<div class="relative">
					<button class="btn-secondary" onclick={() => showMoreMenu = !showMoreMenu}>
						More
						<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if showMoreMenu}
						<div
							class="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-20 py-1"
							onmouseleave={() => showMoreMenu = false}
						>
							<button
								class="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
								onclick={() => { showMoreMenu = false; showRefundDialog = true; }}
							>Refund</button>
							<button
								class="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
								onclick={() => { showMoreMenu = false; showCancelDialog = true; }}
							>Cancel Order</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

		<!-- LEFT COLUMN -->
		<div class="lg:col-span-2 space-y-5">

			<!-- Line Items -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border">
					<h2 class="font-semibold text-sm">Items</h2>
				</div>
				<table class="w-full text-sm">
					<tbody class="divide-y divide-border">
						{#each order.lineItems.nodes as item}
							{@const img = item.image?.url ?? item.variant?.image?.url}
							<tr>
								<td class="px-5 py-3">
									<div class="flex items-center gap-3">
										{#if img}
											<button type="button" onclick={() => { lightboxUrl = img; lightboxAlt = item.image?.altText ?? item.title; }} class="shrink-0 cursor-zoom-in">
												<img src={img} alt={item.image?.altText ?? item.title} class="size-12 rounded-md object-cover border border-border hover:opacity-80 transition-opacity" />
											</button>
										{:else}
											<div class="size-12 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
												<svg class="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M4.5 3h15A1.5 1.5 0 0121 4.5v15a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19.5v-15A1.5 1.5 0 014.5 3z" />
												</svg>
											</div>
										{/if}
										<div>
											<div class="font-medium text-foreground">{item.title}</div>
											{#if item.variant?.title && item.variant.title !== 'Default Title'}
												<div class="text-xs text-muted-foreground">{item.variant.title}</div>
											{/if}
											{#if item.variant?.sku}
												<div class="text-xs text-muted-foreground font-mono">SKU: {item.variant.sku}</div>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-5 py-3 text-center text-muted-foreground whitespace-nowrap">× {item.quantity}</td>
								<td class="px-5 py-3 text-right font-medium whitespace-nowrap">
									{formatCurrency(
										(parseFloat(item.originalUnitPriceSet.shopMoney.amount) * item.quantity).toFixed(2),
										item.originalUnitPriceSet.shopMoney.currencyCode
									)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<!-- Totals -->
				<div class="px-5 py-3 border-t border-border space-y-1.5 text-sm">
					{#if order.discountCodes.length > 0}
						<div class="flex justify-between text-muted-foreground">
							<span>Discount codes</span>
							<span class="flex gap-1">
								{#each order.discountCodes as dc}
									<span class="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{dc}</span>
								{/each}
							</span>
						</div>
					{/if}
					{#if order.shippingLines.nodes.length > 0}
						{#each order.shippingLines.nodes as line}
							<div class="flex justify-between text-muted-foreground">
								<span>Shipping · {line.title}</span>
								<span>{formatCurrency(line.originalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
							</div>
						{/each}
					{/if}
					<div class="flex justify-between font-bold text-base pt-1 border-t border-border">
						<span>Total</span>
						<span>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
				</div>
			</div>

			<!-- Refunds -->
			{#if order.refunds.length > 0}
				<div class="card">
					<div class="px-5 py-4 border-b border-border">
						<h2 class="font-semibold text-sm">Refunds</h2>
					</div>
					<div class="divide-y divide-border">
						{#each order.refunds as r}
							<div class="px-5 py-3 flex items-center justify-between text-sm">
								<div>
									<span class="font-mono text-xs text-muted-foreground">{shopifyIdToNumber(r.id)}</span>
									<div class="text-xs text-muted-foreground">{formatDate(r.createdAt)}</div>
								</div>
								<span class="font-semibold">{formatCurrency(r.totalRefundedSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Timeline -->
			{#if order.events?.nodes?.length > 0}
				<div class="card">
					<div class="px-5 py-4 border-b border-border">
						<h2 class="font-semibold text-sm">Timeline</h2>
					</div>
					<div class="px-5 py-4">
						<ol class="relative border-l border-border space-y-5">
							{#each order.events.nodes as event}
								<li class="ml-4">
									<div class="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-card bg-border"></div>
									<p class="text-sm text-foreground">{event.message}</p>
									<time class="text-xs text-muted-foreground">{formatDate(event.createdAt)}</time>
								</li>
							{/each}
						</ol>
					</div>
				</div>
			{/if}

			<!-- Note -->
			{#if order.note}
				<div class="card px-5 py-4">
					<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Order Note</div>
					<p class="text-sm text-foreground">{order.note}</p>
				</div>
			{/if}
		</div>

		<!-- RIGHT COLUMN -->
		<div class="space-y-5">

			<!-- Fulfillments -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border flex items-center justify-between">
					<h2 class="font-semibold text-sm">Fulfillment</h2>
					{#if !isCancelled && !isFulfilled}
						<button class="btn-primary btn-sm text-xs" onclick={() => showFulfillDialog = true}>Fulfill</button>
					{/if}
				</div>
				{#if order.fulfillments.length > 0}
					<div class="divide-y divide-border">
						{#each order.fulfillments as f}
							<div class="px-5 py-3">
								<div class="flex items-center gap-2 mb-2">
									<span class="badge-fulfilled text-xs">{f.status}</span>
									<span class="text-xs text-muted-foreground">{f.fulfillmentLineItems.nodes.length} item(s)</span>
								</div>
								{#if f.trackingInfo.length > 0}
									{#each f.trackingInfo as t}
										<div class="flex items-center gap-2 text-sm">
											<span class="font-mono font-medium text-xs">{t.number}</span>
											{#if t.url}
												<a href={t.url} target="_blank" class="text-primary text-xs hover:underline">Track →</a>
											{/if}
										</div>
									{/each}
								{:else}
									<p class="text-xs text-muted-foreground">No tracking number</p>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="px-5 py-4 text-sm text-muted-foreground">Not fulfilled yet</div>
				{/if}
			</div>

			<!-- Customer -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border">
					<h2 class="font-semibold text-sm">Customer</h2>
				</div>
				<div class="px-5 py-4 space-y-2 text-sm">
					{#if order.customer}
						<div class="font-medium text-foreground">{order.customer.displayName}</div>
						{#if order.customer.email}
							<div class="text-muted-foreground">{order.customer.email}</div>
						{/if}
						{#if order.customer.phone}
							<div class="text-muted-foreground">{order.customer.phone}</div>
						{/if}
						<a href="/dashboard/stores/{storeId}/customers/{order.customer.id.split('/').pop()}" class="text-primary text-xs hover:underline block mt-1">View profile →</a>
					{:else}
						<span class="text-muted-foreground">Guest order</span>
					{/if}
				</div>
			</div>

			<!-- Shipping Address -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border flex items-center justify-between">
					<h2 class="font-semibold text-sm">Shipping Address</h2>
					{#if order.shippingAddress && !isCancelled}
						<button class="btn-ghost btn-sm text-xs" onclick={() => editShipping = !editShipping}>
							{editShipping ? 'Cancel' : 'Edit'}
						</button>
					{/if}
				</div>
				<div class="px-5 py-4">
					{#if editShipping && order.shippingAddress}
						<form method="POST" action="?/updateShipping" use:enhance={() => async ({ update }) => { await update(); editShipping = false; }} class="space-y-3">
							<div class="grid grid-cols-2 gap-2">
								<div class="space-y-1">
									<label class="label text-xs">First Name</label>
									<input name="firstName" class="input h-8 text-xs" value={order.shippingAddress.name.split(' ')[0]} required />
								</div>
								<div class="space-y-1">
									<label class="label text-xs">Last Name</label>
									<input name="lastName" class="input h-8 text-xs" value={order.shippingAddress.name.split(' ').slice(1).join(' ')} required />
								</div>
							</div>
							<input name="address1" class="input h-8 text-xs" placeholder="Address" value={order.shippingAddress.address1} required />
							<div class="grid grid-cols-2 gap-2">
								<input name="city" class="input h-8 text-xs" placeholder="City" value={order.shippingAddress.city} required />
								<input name="zip" class="input h-8 text-xs" placeholder="ZIP" value={order.shippingAddress.zip} />
							</div>
							<div class="grid grid-cols-2 gap-2">
								<input name="province" class="input h-8 text-xs" placeholder="Province" value={order.shippingAddress.province} />
								<input name="country" class="input h-8 text-xs" placeholder="Country" value={order.shippingAddress.country} required />
							</div>
							<input name="phone" class="input h-8 text-xs" placeholder="Phone" value={order.shippingAddress.phone ?? ''} />
							<div class="flex gap-2">
								<button type="submit" class="btn-primary btn-sm">Save</button>
								<button type="button" class="btn-secondary btn-sm" onclick={() => editShipping = false}>Cancel</button>
							</div>
						</form>
					{:else if order.shippingAddress}
						<address class="not-italic text-sm text-foreground space-y-0.5">
							<div class="font-medium">{order.shippingAddress.name}</div>
							<div class="text-muted-foreground">{order.shippingAddress.address1}</div>
							<div class="text-muted-foreground">{order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}</div>
							<div class="text-muted-foreground">{order.shippingAddress.country}</div>
							{#if order.shippingAddress.phone}
								<div class="text-muted-foreground">{order.shippingAddress.phone}</div>
							{/if}
						</address>
					{:else}
						<p class="text-sm text-muted-foreground">No shipping address</p>
					{/if}
				</div>
			</div>

			<!-- Order summary -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border">
					<h2 class="font-semibold text-sm">Summary</h2>
				</div>
				<div class="px-5 py-4 space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Order ID</span>
						<span class="font-mono text-xs">{shopifyIdToNumber(order.id)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Payment</span>
						<span class="badge-partial text-xs">{order.displayFinancialStatus}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Fulfillment</span>
						<span class="{statusClass(order.displayFinancialStatus, order.displayFulfillmentStatus)} text-xs">{order.displayFulfillmentStatus}</span>
					</div>
					<div class="flex justify-between font-semibold border-t border-border pt-2">
						<span>Total</span>
						<span>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
				</div>
			</div>

		</div>
	</div>
</div>

<!-- Cancel dialog -->
{#if showCancelDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Cancel {order.name}?</h2>
				<p class="text-sm text-muted-foreground">This cannot be undone.</p>
			</div>
			<div class="card-content">
				<form method="POST" action="?/cancel" use:enhance={() => { showCancelDialog = false; return async ({update}) => update(); }} class="space-y-4">
					<div class="space-y-1.5">
						<label class="label" for="reason">Reason</label>
						<select id="reason" name="reason" class="input">
							<option value="CUSTOMER">Customer request</option>
							<option value="FRAUD">Fraud</option>
							<option value="INVENTORY">Inventory</option>
							<option value="DECLINED">Payment declined</option>
							<option value="OTHER">Other</option>
						</select>
					</div>
					<label class="flex items-center gap-2 text-sm cursor-pointer">
						<input type="checkbox" name="refund" value="true" class="rounded" />
						Refund payment
					</label>
					<div class="flex gap-3">
						<button type="submit" class="btn-destructive">Cancel Order</button>
						<button type="button" class="btn-secondary" onclick={() => showCancelDialog = false}>Keep Order</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Fulfill dialog -->
{#if showFulfillDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Fulfill {order.name}</h2>
			</div>
			<div class="card-content">
				<form method="POST" action="?/fulfill" use:enhance={() => { showFulfillDialog = false; return async ({update}) => update(); }} class="space-y-4">
					<div class="space-y-1.5">
						<label class="label" for="trackingCompany">Courier</label>
						<select id="trackingCompany" name="trackingCompany" class="input">
							<option value="">— Select courier —</option>
							<option value="TCS">TCS</option>
							<option value="Leopards">Leopards Courier</option>
							<option value="M&P">M&P Courier</option>
							<option value="Trax">Trax</option>
							<option value="DHL">DHL</option>
							<option value="FedEx">FedEx</option>
							<option value="UPS">UPS</option>
							<option value="Other">Other</option>
						</select>
					</div>
					<div class="space-y-1.5">
						<label class="label" for="trackingNumber">Tracking Number</label>
						<input id="trackingNumber" name="trackingNumber" class="input font-mono" placeholder="Optional" />
					</div>
					<div class="flex gap-3">
						<button type="submit" class="btn-primary">Mark Fulfilled</button>
						<button type="button" class="btn-secondary" onclick={() => showFulfillDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Lightbox -->
{#if lightboxUrl}
	<div
		class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onclick={() => lightboxUrl = null}
		onkeydown={(e) => e.key === 'Escape' && (lightboxUrl = null)}
		tabindex="-1"
	>
		<div class="relative max-w-4xl max-h-full" onclick={(e) => e.stopPropagation()}>
			<button
				class="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1"
				onclick={() => lightboxUrl = null}
			>
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
				Close
			</button>
			<img
				src={lightboxUrl}
				alt={lightboxAlt}
				class="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain"
			/>
			{#if lightboxAlt}
				<p class="text-white/60 text-sm text-center mt-3">{lightboxAlt}</p>
			{/if}
		</div>
	</div>
{/if}

<!-- Refund dialog -->
{#if showRefundDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-lg shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Refund Items</h2>
			</div>
			<div class="card-content">
				<form method="POST" action="?/refund" use:enhance={() => { showRefundDialog = false; return async ({update}) => update(); }} class="space-y-4">
					<div class="space-y-2">
						{#each order.lineItems.nodes as item}
							<div class="flex items-center gap-3 border border-border rounded-lg px-4 py-3">
								<input type="hidden" name="lineItemId" value={item.id} />
								<div class="flex-1 text-sm">
									<div class="font-medium">{item.title}</div>
									<div class="text-xs text-muted-foreground">Ordered: {item.quantity}</div>
								</div>
								<div class="flex items-center gap-2">
									<label class="text-xs text-muted-foreground">Qty</label>
									<input name="quantity" type="number" min="0" max={item.quantity} value={item.quantity} class="input w-16 text-center h-8" />
								</div>
							</div>
						{/each}
					</div>
					<div class="space-y-1.5">
						<label class="label" for="note">Note</label>
						<input id="note" name="note" class="input" placeholder="Reason for refund" />
					</div>
					<div class="flex gap-3">
						<button type="submit" class="btn-primary">Submit Refund</button>
						<button type="button" class="btn-secondary" onclick={() => showRefundDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
