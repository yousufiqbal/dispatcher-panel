<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { page } from '$app/stores';
	import { formatCurrency, formatDate, shopifyIdToNumber } from '$lib/utils';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');
	let showMoreMenu = $state(false);
	let showCancelDialog = $state(false);
	let showConfirmDialog = $state(false);
	let showUnconfirmDialog = $state(false);
	let showFulfillDialog = $state(false);
	let showRefundDialog = $state(false);
	let showInvoiceDialog = $state(false);
	let showMarkPaidDialog = $state(false);
	let showDuplicateDialog = $state(false);
	let editShipping = $state(false);
	let submitting = $state<string | null>(null);

	const order = $derived(data.order);
	const storeId = $derived($page.params.storeId);

	const isCancelled = $derived(
		order.displayFinancialStatus === 'VOIDED' || order.displayFinancialStatus === 'REFUNDED'
	);
	const isFulfilled = $derived(order.displayFulfillmentStatus === 'FULFILLED');
	const isConfirmed = $derived(order.tags.includes('Confirmed'));
	const customerPhone = $derived(order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone);

	function statusClass(financial: string, fulfillment: string) {
		if (financial === 'REFUNDED' || financial === 'VOIDED') return 'badge-cancelled';
		if (fulfillment === 'FULFILLED') return 'badge-fulfilled';
		if (financial === 'PENDING') return 'badge-pending';
		return 'badge-partial';
	}
</script>

{#snippet spinner()}
	<svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
		<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
		<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
	</svg>
{/snippet}

<svelte:head>
	<title>Order {order.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 space-y-4">

	<!-- Header -->
	<div class="flex items-start justify-between gap-4 flex-wrap">
		<div class="flex items-start gap-3">
			<a href="/dispatcher/stores/{storeId}/orders" class="btn-secondary btn-icon shrink-0" title="Back to Orders">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
			</a>
			<div>
				<div class="flex items-center gap-3 flex-wrap">
					<h1 class="text-2xl font-bold">{order.name}</h1>
					<span class="badge-partial">{order.displayFinancialStatus.replace(/_/g,' ')}</span>
					<span class="{statusClass(order.displayFinancialStatus, order.displayFulfillmentStatus)}">{order.displayFulfillmentStatus.replace(/_/g,' ')}</span>
				</div>
				<p class="text-sm text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
			</div>
		</div>

		{#if !isCancelled}
			<div class="flex items-center gap-2">
				{#if customerPhone}
					<a href="tel:{customerPhone}" class="btn-secondary btn-icon" title="Call {customerPhone}">
						<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
						</svg>
					</a>
				{/if}
				{#if !isFulfilled}
				<a href="/dispatcher/stores/{storeId}/orders/{$page.params.orderId}/edit" class="btn-secondary">Edit</a>
			{/if}
				{#if !isFulfilled && !isConfirmed}
					<button class="btn-primary" onclick={() => showConfirmDialog = true}>Confirm Order</button>
				{/if}
				{#if !isFulfilled && isConfirmed}
					<button class="btn-primary" onclick={() => showFulfillDialog = true}>Fulfill Order</button>
				{/if}
				<div class="relative">
					<button class="btn-secondary btn-icon" onclick={() => showMoreMenu = !showMoreMenu} title="More actions">
						<svg class="size-4" fill="currentColor" viewBox="0 0 24 24">
							<circle cx="5" cy="12" r="2" />
							<circle cx="12" cy="12" r="2" />
							<circle cx="19" cy="12" r="2" />
						</svg>
					</button>
					{#if showMoreMenu}
						<div
							class="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-20 py-1"
							onmouseleave={() => showMoreMenu = false}
						>
							{#if isConfirmed && !isFulfilled}
								<button
									class="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
									onclick={() => { showMoreMenu = false; showUnconfirmDialog = true; }}
								>Unconfirm Order</button>
							{/if}
							<button
								class="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
								onclick={() => { showMoreMenu = false; showRefundDialog = true; }}
							>Refund</button>
							<button
								class="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
								onclick={() => { showMoreMenu = false; showDuplicateDialog = true; }}
							>Duplicate Order</button>
							<a
								href="/dispatcher/stores/{storeId}/orders/{$page.params.orderId}/invoice"
								target="_blank"
								class="block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
								onclick={() => showMoreMenu = false}
							>Download Invoice</a>
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

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

		<!-- Shipping Address (mobile only — shown first; desktop copy is in the right column below) -->
		<div class="card lg:hidden">
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
					<form method="POST" action="?/updateShipping" use:enhance={() => { submitting = 'shipping'; return async ({ result, update }) => {
					await update();
					submitting = null;
					if (result.type === 'redirect' || result.type === 'success') {
						addToast('Shipping address updated');
						editShipping = false;
					} else {
						addToast('Failed to update shipping address', 'error');
					}
				}; }} class="space-y-3">
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
							<button type="submit" class="btn-primary btn-sm" disabled={submitting === 'shipping'}>
								{#if submitting === 'shipping'}{@render spinner()}{/if}Save
							</button>
							<button type="button" class="btn-secondary btn-sm" disabled={submitting === 'shipping'} onclick={() => editShipping = false}>Cancel</button>
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

		<!-- LEFT COLUMN -->
		<div class="lg:col-span-2 lg:col-start-1 space-y-5">

			<!-- Line Items -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border flex items-center justify-between">
					<h2 class="font-semibold text-sm">Items</h2>
					<span class="text-xs font-medium text-muted-foreground">
						{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)} total
					</span>
				</div>
				<!-- Desktop table -->
				<table class="w-full text-sm hidden md:table">
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
												<div class="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-semibold">{item.variant.title}</div>
											{/if}
											{#if item.variant?.sku}
												<div class="text-xs text-muted-foreground font-mono">SKU: {item.variant.sku}</div>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-5 py-3 text-center whitespace-nowrap">
								<span class="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded bg-muted text-foreground text-xs font-semibold">×{item.quantity}</span>
							</td>
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

				<!-- Mobile stacked list -->
				<div class="md:hidden divide-y divide-border">
					{#each order.lineItems.nodes as item}
						{@const img = item.image?.url ?? item.variant?.image?.url}
						<div class="px-4 py-3 flex items-start gap-3">
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
							<div class="flex-1 min-w-0">
								<div class="font-medium text-foreground">{item.title}</div>
								{#if item.variant?.title && item.variant.title !== 'Default Title'}
									<div class="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-semibold">{item.variant.title}</div>
								{/if}
								{#if item.variant?.sku}
									<div class="text-xs text-muted-foreground font-mono">SKU: {item.variant.sku}</div>
								{/if}
								<div class="flex items-center justify-between gap-2 mt-1.5">
									<span class="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded bg-muted text-foreground text-xs font-semibold">×{item.quantity}</span>
									<span class="text-sm font-medium text-foreground">
										{formatCurrency(
											(parseFloat(item.originalUnitPriceSet.shopMoney.amount) * item.quantity).toFixed(2),
											item.originalUnitPriceSet.shopMoney.currencyCode
										)}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
				{#if order.discountCodes.length > 0}
					<div class="px-5 py-3 border-t border-border text-sm flex items-center gap-2">
						<span class="text-muted-foreground">Discount codes:</span>
						{#each order.discountCodes as dc}
							<span class="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{dc}</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Payment summary -->
			<div class="card overflow-hidden">
				<div class="divide-y divide-border text-sm">
					<div class="flex items-center justify-between px-5 py-3">
						<span class="text-muted-foreground">Subtotal</span>
						<span class="text-muted-foreground text-xs">{order.lineItems.nodes.reduce((s, i) => s + i.quantity, 0)} items</span>
						<span>{formatCurrency(order.subtotalPriceSet?.shopMoney?.amount ?? '0', order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
					{#each order.shippingLines.nodes as line}
						<div class="flex items-center justify-between px-5 py-3">
							<span class="text-muted-foreground">Shipping</span>
							<span class="text-muted-foreground text-xs truncate max-w-[180px]">{line.title}</span>
							<span>{formatCurrency(line.originalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
						</div>
					{/each}
					<div class="flex items-center justify-between px-5 py-3 font-bold">
						<span>Total</span>
						<span></span>
						<span>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
					<div class="flex items-center justify-between px-5 py-3 bg-muted/20">
						<span class="text-muted-foreground">Paid</span>
						<span></span>
						<span>{formatCurrency(order.totalReceivedSet?.shopMoney?.amount ?? '0', order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
					<div class="flex items-center justify-between px-5 py-3 bg-muted/20">
						<span class="text-muted-foreground">Balance</span>
						<span></span>
						<span class="{(parseFloat(order.totalPriceSet.shopMoney.amount) - parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0')) > 0 ? 'text-destructive font-semibold' : 'text-green-700 font-semibold'}">
							{formatCurrency(Math.abs(parseFloat(order.totalPriceSet.shopMoney.amount) - parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0')).toFixed(2), order.totalPriceSet.shopMoney.currencyCode)}
						</span>
					</div>
					<div class="flex items-center justify-end gap-2 px-5 py-3">
						<button type="button" class="btn-secondary btn-sm" onclick={() => showInvoiceDialog = true}>Resend invoice</button>
						<button type="button" class="btn-primary btn-sm" onclick={() => showMarkPaidDialog = true}>Mark as paid</button>
					</div>
				</div>
			</div>

			<!-- Note -->
			{#if order.note}
				<div class="card px-5 py-4">
					<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Order Note</div>
					<p class="text-sm text-foreground">{order.note}</p>
				</div>
			{/if}
		</div>

		<!-- Customer (mobile only — desktop copy is in the right column below) -->
		<div class="card lg:hidden">
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
					<a href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}" class="text-primary text-xs hover:underline block mt-1">View profile →</a>
				{:else}
					<span class="text-muted-foreground">Guest order</span>
				{/if}
			</div>
		</div>

		<!-- RIGHT COLUMN (desktop only): Shipping above Customer, stacked tight -->
		<div class="hidden lg:flex lg:col-start-3 flex-col gap-5">
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
						<form method="POST" action="?/updateShipping" use:enhance={() => { submitting = 'shipping'; return async ({ result, update }) => {
						await update();
						submitting = null;
						if (result.type === 'redirect' || result.type === 'success') {
							addToast('Shipping address updated');
							editShipping = false;
						} else {
							addToast('Failed to update shipping address', 'error');
						}
					}; }} class="space-y-3">
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
								<button type="submit" class="btn-primary btn-sm" disabled={submitting === 'shipping'}>
									{#if submitting === 'shipping'}{@render spinner()}{/if}Save
								</button>
								<button type="button" class="btn-secondary btn-sm" disabled={submitting === 'shipping'} onclick={() => editShipping = false}>Cancel</button>
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
						<a href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}" class="text-primary text-xs hover:underline block mt-1">View profile →</a>
					{:else}
						<span class="text-muted-foreground">Guest order</span>
					{/if}
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
				<form method="POST" action="?/cancel" use:enhance={() => { submitting = 'cancel'; return async ({ result, update }) => { await update(); submitting = null; showCancelDialog = false; if (result.type === 'redirect') addToast('Order cancelled'); else addToast('Failed to cancel order', 'error'); }; }} class="space-y-4">
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
						<button type="submit" class="btn-destructive" disabled={submitting === 'cancel'}>
							{#if submitting === 'cancel'}{@render spinner()}{/if}Cancel Order
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'cancel'} onclick={() => showCancelDialog = false}>Keep Order</button>
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
				<form method="POST" action="?/fulfill" use:enhance={() => { submitting = 'fulfill'; return async ({ result, update }) => { await update(); submitting = null; showFulfillDialog = false; if (result.type === 'redirect') addToast('Order fulfilled'); else addToast('Failed to fulfill order', 'error'); }; }} class="space-y-4">
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
						<button type="submit" class="btn-primary" disabled={submitting === 'fulfill'}>
							{#if submitting === 'fulfill'}{@render spinner()}{/if}Mark Fulfilled
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'fulfill'} onclick={() => showFulfillDialog = false}>Cancel</button>
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

<!-- Duplicate order dialog -->
{#if showDuplicateDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Duplicate {order.name}?</h2>
				<p class="text-sm text-muted-foreground">Creates a new draft order with the same products, customer, and shipping address.</p>
			</div>
			<div class="card-content">
				<form method="POST" action="?/duplicateOrder" use:enhance={() => { submitting = 'duplicate'; return async ({ result, update }) => { await update(); submitting = null; showDuplicateDialog = false; if (result.type === 'failure') addToast((result.data as any)?.error || 'Failed to duplicate order', 'error'); }; }}>
					<div class="flex gap-3">
						<button type="submit" class="btn-primary" disabled={submitting === 'duplicate'}>
							{#if submitting === 'duplicate'}{@render spinner()}{/if}Duplicate
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'duplicate'} onclick={() => showDuplicateDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Confirm order dialog -->
{#if showConfirmDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Confirm {order.name}?</h2>
				<p class="text-sm text-muted-foreground">Marks this order as confirmed with the customer. It can then be fulfilled.</p>
			</div>
			<div class="card-content">
				<form method="POST" action="?/confirm" use:enhance={() => { submitting = 'confirm'; return async ({ result, update }) => { await update(); submitting = null; showConfirmDialog = false; if (result.type === 'redirect') addToast('Order confirmed'); else addToast('Failed to confirm order', 'error'); }; }}>
					<div class="flex gap-3">
						<button type="submit" class="btn-primary" disabled={submitting === 'confirm'}>
							{#if submitting === 'confirm'}{@render spinner()}{/if}Confirm Order
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'confirm'} onclick={() => showConfirmDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Unconfirm order dialog -->
{#if showUnconfirmDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Unconfirm {order.name}?</h2>
				<p class="text-sm text-muted-foreground">Removes the confirmed status. Order moves back to Pending and can't be fulfilled until reconfirmed.</p>
			</div>
			<div class="card-content">
				<form method="POST" action="?/unconfirm" use:enhance={() => { submitting = 'unconfirm'; return async ({ result, update }) => { await update(); submitting = null; showUnconfirmDialog = false; if (result.type === 'redirect') addToast('Order unconfirmed'); else addToast('Failed to unconfirm order', 'error'); }; }}>
					<div class="flex gap-3">
						<button type="submit" class="btn-destructive" disabled={submitting === 'unconfirm'}>
							{#if submitting === 'unconfirm'}{@render spinner()}{/if}Unconfirm Order
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'unconfirm'} onclick={() => showUnconfirmDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Mark as paid dialog -->
{#if showMarkPaidDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Mark as Paid?</h2>
				<p class="text-sm text-muted-foreground">This will record a manual payment of <strong>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</strong> on {order.name}. This cannot be undone.</p>
			</div>
			<div class="card-content">
				<form method="POST" action="?/markAsPaid" use:enhance={() => { submitting = 'markAsPaid'; return async ({ result, update }) => { await update(); submitting = null; showMarkPaidDialog = false; if (result.type === 'success' || result.type === 'redirect') addToast('Order marked as paid'); else addToast('Failed to mark as paid', 'error'); }; }}>
					<div class="flex gap-3">
						<button type="submit" class="btn-primary" disabled={submitting === 'markAsPaid'}>
							{#if submitting === 'markAsPaid'}{@render spinner()}{/if}Confirm
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'markAsPaid'} onclick={() => showMarkPaidDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Invoice dialog -->
{#if showInvoiceDialog}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md shadow-xl">
			<div class="card-header">
				<h2 class="text-lg font-semibold">Resend Invoice</h2>
				<p class="text-sm text-muted-foreground">Invoice will be sent to this email.</p>
			</div>
			<div class="card-content">
				<form method="POST" action="?/resendInvoice" use:enhance={() => { submitting = 'invoice'; return async ({ result, update }) => { await update(); submitting = null; showInvoiceDialog = false; if (result.type === 'success') addToast('Invoice sent'); else addToast(result.type === 'failure' && (result.data as any)?.error || 'Failed to send invoice', 'error'); }; }} class="space-y-4">
					<div class="space-y-1.5">
						<label class="label" for="invoiceEmail">Email</label>
						<input id="invoiceEmail" name="email" type="email" class="input" value={order.customer?.email ?? ''} required />
					</div>
					<div class="flex gap-3">
						<button type="submit" class="btn-primary" disabled={submitting === 'invoice'}>
							{#if submitting === 'invoice'}{@render spinner()}{/if}Send Invoice
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'invoice'} onclick={() => showInvoiceDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
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
				<form method="POST" action="?/refund" use:enhance={() => { submitting = 'refund'; return async ({ result, update }) => { await update(); submitting = null; showRefundDialog = false; if (result.type === 'redirect') addToast('Refund submitted'); else addToast('Failed to submit refund', 'error'); }; }} class="space-y-4">
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
						<button type="submit" class="btn-primary" disabled={submitting === 'refund'}>
							{#if submitting === 'refund'}{@render spinner()}{/if}Submit Refund
						</button>
						<button type="button" class="btn-secondary" disabled={submitting === 'refund'} onclick={() => showRefundDialog = false}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
