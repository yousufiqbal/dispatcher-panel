<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { page } from '$app/stores';
	import { formatCurrency, formatDate } from '$lib/utils';
	import { deliveryPill } from '$lib/delivery-status';
	import { clickOutside } from '$lib/actions/clickOutside';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');
	let showCourierMenu = $state(false);
	let showCancelDialog = $state(false);
	let showConfirmDialog = $state(false);
	let showUnconfirmDialog = $state(false);
	let showFulfillDialog = $state(false);
	let showRefundDialog = $state(false);
	let showInvoiceDialog = $state(false);
	let showMarkPaidDialog = $state(false);
	let showDuplicateDialog = $state(false);
	let showUnbookDialog = $state(false);
	let showEditContactModal = $state(false);
	let showEditShippingModal = $state(false);
	let showDiscountModal = $state(false);
	let discountPercentage = $state('');
	let applyingDiscount = $state(false);
	let editNote = $state(false);
	let noteInput = $state('');
	let tagsInputEl = $state<HTMLInputElement | null>(null);
	let submitting = $state<string | null>(null);

	const order = $derived(data.order);
	const storeId = $derived($page.params.storeId);

	const isCancelled = $derived(
		order.displayFinancialStatus === 'VOIDED' || order.displayFinancialStatus === 'REFUNDED'
	);
	const isFulfilled = $derived(order.displayFulfillmentStatus === 'FULFILLED');
	// Shopify's fulfillment displayStatus — same as the admin's "Delivery status" column.
	const delivery = $derived(
		deliveryPill(
			order.fulfillments.find((f) => f.displayStatus)?.displayStatus,
			!!data.booking || order.fulfillments.some((f) => f.trackingInfo.some((t) => t.number))
		)
	);
	const isConfirmed = $derived(order.tags.includes('Confirmed'));
	const customerPhone = $derived(order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone);
	// currentQuantity 0 means the line item was fully removed via order editing —
	// Shopify's admin shows those separately in a "Removed" card.
	const activeLineItems = $derived(order.lineItems.nodes.filter((i) => i.currentQuantity > 0));
	const removedLineItems = $derived(order.lineItems.nodes.filter((i) => i.currentQuantity === 0));

	const shippingTotal = $derived(
		order.shippingLines.nodes.reduce((s, l) => s + parseFloat(l.originalPriceSet.shopMoney.amount), 0)
	);
	// Discounts targeting the shipping line (e.g. a "Free Shipping" code or
	// automatic discount) — shown as their own row in the payment summary.
	const shippingDiscounts = $derived(
		order.discountApplications.nodes
			.filter((d) => d.targetType === 'SHIPPING_LINE')
			.map((d) => ({
				label: d.code ?? d.title ?? 'Discount',
				amount: d.value.amount != null
					? parseFloat(d.value.amount)
					: d.value.percentage != null
						? shippingTotal * (d.value.percentage / 100)
						: 0
			}))
	);

	const paymentPill = $derived(financialStatusPill(order.displayFinancialStatus));

	function financialStatusPill(status: string): { label: string; class: string; icon: 'clock' | null } {
		if (status === 'PENDING') return { label: 'Payment pending', class: 'bg-amber-100 text-amber-800', icon: 'clock' };
		if (status === 'PAID') return { label: 'Paid', class: 'bg-green-100 text-green-800', icon: null };
		if (status === 'PARTIALLY_PAID') return { label: 'Partially paid', class: 'bg-amber-100 text-amber-800', icon: 'clock' };
		if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return { label: 'Refunded', class: 'bg-red-100 text-red-700', icon: null };
		if (status === 'VOIDED') return { label: 'Voided', class: 'bg-zinc-100 text-zinc-700', icon: null };
		return { label: status.replace(/_/g, ' '), class: 'bg-zinc-100 text-zinc-700', icon: null };
	}

	function openEditNote() {
		noteInput = order.note ?? '';
		editNote = true;
	}

	let tagsInput = $state(order.tags.join(', '));

	function statusClass(financial: string, fulfillment: string) {
		if (financial === 'REFUNDED' || financial === 'VOIDED') return 'badge-cancelled';
		if (fulfillment === 'FULFILLED') return 'badge-fulfilled';
		if (financial === 'PENDING') return 'badge-pending';
		return 'badge-partial';
	}

	// Cancel dialog
	let cancelReason = $state('CUSTOMER');
	const CANCEL_REASONS: Record<string, string> = {
		CUSTOMER: 'Customer request',
		FRAUD: 'Fraud',
		INVENTORY: 'Inventory',
		DECLINED: 'Payment declined',
		OTHER: 'Other'
	};

	// Fulfill dialog
	let trackingCompany = $state('');
	const COURIER_OPTIONS: Record<string, string> = {
		'': '— Select courier —',
		PostEx: 'PostEx',
		DEX: 'DEX',
		TCS: 'TCS',
		Leopards: 'Leopards Courier',
		'M&P': 'M&P Courier',
		Trax: 'Trax',
		DHL: 'DHL',
		FedEx: 'FedEx',
		UPS: 'UPS',
		Other: 'Other'
	};
</script>

{#snippet spinner()}
	<Loader2Icon class="size-4 animate-spin" />
{/snippet}

{#snippet notesCard()}
	<div class="card">
		<div class="px-5 py-4 border-b border-border flex items-center justify-between">
			<h2 class="font-semibold text-sm">Notes</h2>
			{#if !isCancelled}
				<button class="text-muted-foreground hover:text-foreground" title="Edit note" onclick={() => editNote ? (editNote = false) : openEditNote()}>
					<PencilIcon class="size-3.5" />
				</button>
			{/if}
		</div>
		<div class="px-5 py-4">
			{#if editNote}
				<form method="POST" action="?/updateNote" use:enhance={() => { submitting = 'note'; return async ({ result, update }) => {
					await update();
					submitting = null;
					if (result.type === 'redirect' || result.type === 'success') {
						addToast('Note updated');
						editNote = false;
					} else {
						addToast('Failed to update note', 'error');
					}
				}; }} class="space-y-2">
					<textarea name="note" class="input min-h-20 text-sm" bind:value={noteInput}></textarea>
					<div class="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting === 'note'}>
							{#if submitting === 'note'}{@render spinner()}{/if}Save
						</Button>
						<Button type="button" variant="outline" size="sm" disabled={submitting === 'note'} onclick={() => editNote = false}>Cancel</Button>
					</div>
				</form>
			{:else}
				<p class="text-sm text-muted-foreground">{order.note || 'No notes from customer'}</p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet customerCard()}
	<div class="card">
		<div class="px-5 py-4 border-b border-border flex items-center justify-between">
			<h2 class="font-semibold text-sm">Customer</h2>
			{#if !isCancelled}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button {...props} class="text-muted-foreground hover:text-foreground" title="More">
								<MoreHorizontalIcon class="size-4" />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-52">
						<DropdownMenu.Item onclick={() => showEditContactModal = true}>Edit contact information</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => showEditShippingModal = true}>Edit shipping address</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>
		<div class="px-5 py-4 space-y-4 text-sm">
			{#if order.customer}
				<div>
					<a href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}" class="text-primary hover:underline block">{order.customer.displayName}</a>
					{#if order.customer.numberOfOrders > 0}
						<a href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}" class="text-primary hover:underline text-xs">
							{order.customer.numberOfOrders} order{order.customer.numberOfOrders === 1 ? '' : 's'}
						</a>
					{/if}
				</div>
			{:else}
				<div class="text-muted-foreground">Guest order</div>
			{/if}

			{#if order.customer?.email || order.customer?.phone}
				<div>
					<div class="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Contact information</div>
					{#if order.customer.email}<a href="mailto:{order.customer.email}" class="text-primary hover:underline block">{order.customer.email}</a>{/if}
					{#if order.customer.phone}<div class="text-muted-foreground">{order.customer.phone}</div>{/if}
				</div>
			{/if}

			{#if order.shippingAddress}
				<div>
					<div class="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Shipping address</div>
					<address class="not-italic text-foreground space-y-0.5">
						<div>{order.shippingAddress.name}</div>
						<div>{order.shippingAddress.address1}</div>
						{#if order.shippingAddress.address2}<div>{order.shippingAddress.address2}</div>{/if}
						<div>{order.shippingAddress.city} {order.shippingAddress.zip}</div>
						<div>{order.shippingAddress.country}</div>
						{#if order.shippingAddress.phone}<div>{order.shippingAddress.phone}</div>{/if}
					</address>
					<a
						href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent([order.shippingAddress.address1, order.shippingAddress.city, order.shippingAddress.province, order.shippingAddress.country].filter(Boolean).join(', '))}"
						target="_blank"
						rel="noopener"
						class="text-primary hover:underline text-xs block mt-2"
					>View map</a>
				</div>

				<div>
					<div class="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Billing address</div>
					{#if !order.billingAddress || (order.billingAddress.address1 === order.shippingAddress.address1 && order.billingAddress.city === order.shippingAddress.city && order.billingAddress.zip === order.shippingAddress.zip)}
						<p class="text-muted-foreground">Same as shipping address</p>
					{:else}
						<address class="not-italic text-foreground space-y-0.5">
							<div>{order.billingAddress.name}</div>
							<div>{order.billingAddress.address1}</div>
							{#if order.billingAddress.address2}<div>{order.billingAddress.address2}</div>{/if}
							<div>{order.billingAddress.city} {order.billingAddress.zip}</div>
							<div>{order.billingAddress.country}</div>
						</address>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet tagsCard()}
	<div class="card">
		<div class="px-5 py-4 border-b border-border flex items-center justify-between">
			<h2 class="font-semibold text-sm">Tags</h2>
			{#if !isCancelled}
				<button class="text-muted-foreground hover:text-foreground" title="Edit tags" onclick={() => tagsInputEl?.focus()}>
					<PencilIcon class="size-3.5" />
				</button>
			{/if}
		</div>
		<div class="px-5 py-4">
			<form method="POST" action="?/updateTags" use:enhance={() => { submitting = 'tags'; return async ({ result, update }) => {
				await update();
				submitting = null;
				if (result.type === 'redirect' || result.type === 'success') addToast('Tags updated');
				else addToast('Failed to update tags', 'error');
			}; }}>
				<Input
					bind:ref={tagsInputEl}
					name="tags"
					bind:value={tagsInput}
					placeholder="Add tags, comma-separated"
					disabled={isCancelled}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).form?.requestSubmit(); } }}
					onblur={(e) => (e.currentTarget as HTMLInputElement).form?.requestSubmit()}
				/>
			</form>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>Order {order.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 space-y-4">

	<!-- Header -->
	<div class="flex items-start justify-between gap-4 flex-wrap">
		<div class="flex items-start gap-3">
			<Button href="/dispatcher/stores/{storeId}/orders" variant="outline" size="icon" class="shrink-0" title="Back to Orders">
				<ArrowLeftIcon class="size-4" />
			</Button>
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
					<Button href="tel:{customerPhone}" variant="outline" size="icon" title="Call {customerPhone}">
						<PhoneIcon class="size-4" />
					</Button>
				{/if}
				{#if !isFulfilled}
					<Button href="/dispatcher/stores/{storeId}/orders/{$page.params.orderId}/edit" variant="outline">Edit</Button>
				{/if}
				{#if !isFulfilled && !isConfirmed}
					<Button onclick={() => showConfirmDialog = true}>Confirm Order</Button>
				{/if}
				{#if !isFulfilled && isConfirmed}
					{#if data.couriers.length === 0}
						<span class="text-xs text-muted-foreground self-center">No courier assigned to this store</span>
					{:else if data.couriers.length === 1}
						<Button href="/dispatcher/stores/{storeId}/orders/book/{data.couriers[0].id}?ids={$page.params.orderId}">
							Book & Fulfill Order
						</Button>
					{:else}
						<div class="relative" use:clickOutside={() => showCourierMenu = false}>
							<Button onclick={() => showCourierMenu = !showCourierMenu}>
								Book & Fulfill Order
								<ChevronDownIcon class="size-4" />
							</Button>
							{#if showCourierMenu}
								<div class="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-20 py-1">
									{#each data.couriers as c}
										<a
											href="/dispatcher/stores/{storeId}/orders/book/{c.id}?ids={$page.params.orderId}"
											class="block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
											onclick={() => showCourierMenu = false}
										>{c.name}</a>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{/if}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="icon" title="More actions">
								<MoreHorizontalIcon class="size-4" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-44">
						{#if isConfirmed && !isFulfilled}
							<DropdownMenu.Item onclick={() => showFulfillDialog = true}>Fulfill Order</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => showUnconfirmDialog = true}>Unconfirm Order</DropdownMenu.Item>
						{/if}
						{#if isFulfilled}
							<DropdownMenu.Item variant="destructive" onclick={() => showUnbookDialog = true}>
								{data.booking ? 'Unbook & Unfulfill' : 'Unfulfill'}
							</DropdownMenu.Item>
						{/if}
						{#if order.displayFinancialStatus !== 'PENDING'}
							<DropdownMenu.Item onclick={() => showRefundDialog = true}>Refund</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Item onclick={() => showDuplicateDialog = true}>Duplicate Order</DropdownMenu.Item>
						{#if !isCancelled}
							<DropdownMenu.Item onclick={() => { discountPercentage = ''; showDiscountModal = true; }}>Add discount to items</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Item onclick={() => window.open(`/dispatcher/stores/${storeId}/orders/${$page.params.orderId}/invoice`, '_blank')}>
							Download Invoice
						</DropdownMenu.Item>
						<DropdownMenu.Item variant="destructive" onclick={() => showCancelDialog = true}>Cancel Order</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		{/if}
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

		<!-- Notes/Customer/Tags (mobile only — desktop copy is in the right column below) -->
		<div class="lg:hidden space-y-5">
			{@render notesCard()}
			{@render customerCard()}
			{@render tagsCard()}
		</div>

		<!-- LEFT COLUMN -->
		<div class="lg:col-span-2 lg:col-start-1 space-y-5">

			<!-- Line Items -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border flex items-center justify-between">
					<h2 class="font-semibold text-sm">Items</h2>
					<span class="text-xs font-medium text-muted-foreground">
						{activeLineItems.reduce((s, i) => s + i.currentQuantity, 0)} total
					</span>
				</div>
				<!-- Desktop table -->
				<table class="w-full text-sm hidden md:table">
					<tbody class="divide-y divide-border">
						{#each activeLineItems as item}
							{@const img = item.image?.url ?? item.variant?.image?.url}
							<tr>
								<td class="px-5 py-3">
									<div class="flex items-center gap-3">
										<span class="size-14 rounded-md bg-white text-foreground border border-border flex items-center justify-center shrink-0 text-base font-bold">
											{item.currentQuantity}×
										</span>
										{#if img}
											<button type="button" onclick={() => { lightboxUrl = img; lightboxAlt = item.image?.altText ?? item.title; }} class="shrink-0 cursor-zoom-in">
												<img src={img} alt={item.image?.altText ?? item.title} class="size-14 rounded-md object-cover border border-border hover:opacity-80 transition-opacity" />
											</button>
										{:else}
											<div class="size-14 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
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
								<td class="px-5 py-3 text-right font-medium whitespace-nowrap">
									{formatCurrency(
										(parseFloat(item.originalUnitPriceSet.shopMoney.amount) * item.currentQuantity).toFixed(2),
										item.originalUnitPriceSet.shopMoney.currencyCode
									)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<!-- Mobile stacked list -->
				<div class="md:hidden divide-y divide-border">
					{#each activeLineItems as item}
						{@const img = item.image?.url ?? item.variant?.image?.url}
						<div class="px-4 py-3 flex items-start gap-3">
							<span class="size-14 rounded-md bg-white text-foreground border border-border flex items-center justify-center shrink-0 text-base font-bold">
								{item.currentQuantity}×
							</span>
							{#if img}
								<button type="button" onclick={() => { lightboxUrl = img; lightboxAlt = item.image?.altText ?? item.title; }} class="shrink-0 cursor-zoom-in">
									<img src={img} alt={item.image?.altText ?? item.title} class="size-14 rounded-md object-cover border border-border hover:opacity-80 transition-opacity" />
								</button>
							{:else}
								<div class="size-14 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
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
								<div class="flex items-center justify-end gap-2 mt-1.5">
									<span class="text-sm font-medium text-foreground">
										{formatCurrency(
											(parseFloat(item.originalUnitPriceSet.shopMoney.amount) * item.currentQuantity).toFixed(2),
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

			<!-- Removed items -->
			{#if removedLineItems.length > 0}
				<div class="card overflow-hidden">
					<div class="px-5 py-4 border-b border-border">
						<h2 class="font-semibold text-sm">Removed</h2>
					</div>
					<div class="divide-y divide-border">
						{#each removedLineItems as item}
							{@const img = item.image?.url ?? item.variant?.image?.url}
							<div class="px-5 py-3 flex items-center gap-3 text-muted-foreground">
								{#if img}
									<img src={img} alt={item.title} class="size-10 rounded-md object-cover border border-border opacity-50 shrink-0" />
								{:else}
									<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="line-through">{item.title}</div>
									{#if item.variant?.title && item.variant.title !== 'Default Title'}
										<div class="text-xs line-through">{item.variant.title}</div>
									{/if}
								</div>
								<span class="text-xs font-semibold">×{item.quantity}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Payment summary -->
			<div class="card overflow-hidden">
				<div class="px-5 py-3 flex items-center justify-between border-b border-border">
					<span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full {paymentPill.class}">
						{#if paymentPill.icon === 'clock'}<ClockIcon class="size-3.5" />{/if}
						{paymentPill.label}
					</span>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<button {...props} class="text-muted-foreground hover:text-foreground" title="More">
									<MoreHorizontalIcon class="size-4" />
								</button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-44">
							<DropdownMenu.Item onclick={() => showMarkPaidDialog = true}>Mark as paid</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => showInvoiceDialog = true}>Resend invoice</DropdownMenu.Item>
							{#if order.displayFinancialStatus !== 'PENDING'}
								<DropdownMenu.Item onclick={() => showRefundDialog = true}>Refund</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
				<div class="text-sm px-5 py-3 space-y-1.5">
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Subtotal</span>
						<span class="text-muted-foreground text-xs">{activeLineItems.reduce((s, i) => s + i.currentQuantity, 0)} items</span>
						<span>{formatCurrency(order.subtotalPriceSet?.shopMoney?.amount ?? '0', order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
					{#each shippingDiscounts as sd}
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Discount</span>
							<span class="text-muted-foreground text-xs truncate max-w-[180px]">{sd.label}</span>
							<span>-{formatCurrency(sd.amount.toFixed(2), order.totalPriceSet.shopMoney.currencyCode)}</span>
						</div>
					{/each}
					{#each order.shippingLines.nodes as line}
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Shipping</span>
							<span class="text-muted-foreground text-xs truncate max-w-[180px]">{line.title}</span>
							<span>{formatCurrency(line.originalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
						</div>
					{/each}
					<div class="flex items-center justify-between font-bold pt-1.5 border-t border-border">
						<span>Total</span>
						<span></span>
						<span>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Paid</span>
						<span></span>
						<span>{formatCurrency(order.totalReceivedSet?.shopMoney?.amount ?? '0', order.totalPriceSet.shopMoney.currencyCode)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Balance</span>
						<span></span>
						<span class="{(parseFloat(order.totalPriceSet.shopMoney.amount) - parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0')) > 0 ? 'text-destructive font-semibold' : 'text-green-700 font-semibold'}">
							{formatCurrency(Math.abs(parseFloat(order.totalPriceSet.shopMoney.amount) - parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0')).toFixed(2), order.totalPriceSet.shopMoney.currencyCode)}
						</span>
					</div>
					<div class="flex items-center justify-end gap-2 pt-1.5">
						<Button type="button" variant="outline" size="sm" onclick={() => showInvoiceDialog = true}>Send invoice</Button>
						<Button type="button" size="sm" onclick={() => showMarkPaidDialog = true}>Mark as paid</Button>
					</div>
				</div>
			</div>

		</div>

		<!-- RIGHT COLUMN (desktop only): Tracking (if fulfilled), Notes, Customer, Tags -->
		<div class="hidden lg:flex lg:col-start-3 flex-col gap-5">
			{#if isFulfilled}
				{@const fallbackTracking = order.fulfillments.flatMap((f) => f.trackingInfo).find((t) => t.number)}
				<div class="card">
					<div class="px-5 py-4 border-b border-border">
						<h2 class="font-semibold text-sm">Tracking</h2>
					</div>
					<div class="px-5 py-4 space-y-2 text-sm">
						{#if data.booking}
							<div class="font-medium text-foreground">{data.booking.courierName}</div>
							<div class="text-muted-foreground font-mono">{data.booking.trackingId}</div>
							{#if delivery}
								<div>
									<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
										<span class="size-1.5 rounded-full bg-current shrink-0"></span>
										{delivery.label}
									</span>
								</div>
							{/if}
							{#if data.booking.trackingUrl}
								<a href={data.booking.trackingUrl} target="_blank" rel="noopener" class="text-primary text-xs hover:underline block mt-1">Track shipment →</a>
							{/if}
							<a
								href="/dispatcher/stores/{storeId}/orders/labels?ids={$page.params.orderId}"
								target="_blank"
								rel="noopener"
								class="text-primary text-xs hover:underline block mt-1"
							>Print label →</a>
						{:else if fallbackTracking}
							<div class="font-medium text-foreground">{fallbackTracking.company ?? 'Unknown courier'}</div>
							<div class="text-muted-foreground font-mono">{fallbackTracking.number}</div>
							{#if delivery}
								<div>
									<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
										<span class="size-1.5 rounded-full bg-current shrink-0"></span>
										{delivery.label}
									</span>
								</div>
							{/if}
							{#if fallbackTracking.url}
								<a href={fallbackTracking.url} target="_blank" rel="noopener" class="text-primary text-xs hover:underline block mt-1">Track shipment →</a>
							{/if}
						{:else}
							<span class="text-muted-foreground">No tracking info</span>
						{/if}
					</div>
				</div>
			{/if}
			{@render notesCard()}
			{@render customerCard()}
			{@render tagsCard()}
		</div>
	</div>
</div>

<!-- Edit contact information dialog -->
<Dialog.Root bind:open={showEditContactModal}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Edit contact information</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/updateEmail" use:enhance={() => { submitting = 'contact'; return async ({ result, update }) => {
			await update();
			submitting = null;
			if (result.type === 'redirect' || result.type === 'success') {
				addToast('Contact information updated');
				showEditContactModal = false;
			} else {
				addToast('Failed to update contact information', 'error');
			}
		}; }} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="edit-contact-email">Email</Label>
				<Input id="edit-contact-email" name="email" type="email" value={order.customer?.email ?? ''} />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'contact'} onclick={() => showEditContactModal = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'contact'}>
					{#if submitting === 'contact'}{@render spinner()}{/if}Save
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit shipping address dialog -->
<Dialog.Root bind:open={showEditShippingModal}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit shipping address</Dialog.Title>
		</Dialog.Header>
		{#if order.shippingAddress}
			<form method="POST" action="?/updateShipping" use:enhance={() => { submitting = 'shipping'; return async ({ result, update }) => {
				await update();
				submitting = null;
				if (result.type === 'redirect' || result.type === 'success') {
					addToast('Shipping address updated');
					showEditShippingModal = false;
				} else {
					addToast('Failed to update shipping address', 'error');
				}
			}; }} class="space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label class="text-xs">First Name</Label>
						<Input name="firstName" value={order.shippingAddress.name.split(' ')[0]} required />
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs">Last Name</Label>
						<Input name="lastName" value={order.shippingAddress.name.split(' ').slice(1).join(' ')} required />
					</div>
				</div>
				<div class="space-y-1.5">
					<Label class="text-xs">Address</Label>
					<Input name="address1" value={order.shippingAddress.address1} required />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label class="text-xs">City</Label>
						<Input name="city" value={order.shippingAddress.city} required />
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs">ZIP</Label>
						<Input name="zip" value={order.shippingAddress.zip} />
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label class="text-xs">Province</Label>
						<Input name="province" value={order.shippingAddress.province} />
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs">Country</Label>
						<Input name="country" value={order.shippingAddress.country} required />
					</div>
				</div>
				<div class="space-y-1.5">
					<Label class="text-xs">Phone</Label>
					<Input name="phone" value={order.shippingAddress.phone ?? ''} />
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" disabled={submitting === 'shipping'} onclick={() => showEditShippingModal = false}>Cancel</Button>
					<Button type="submit" disabled={submitting === 'shipping'}>
						{#if submitting === 'shipping'}{@render spinner()}{/if}Save
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Add discount to items dialog -->
<Dialog.Root bind:open={showDiscountModal}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Add discount to items</Dialog.Title>
			<Dialog.Description>Applies a percentage discount to every line item on this order.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/applyDiscount" use:enhance={() => {
			applyingDiscount = true;
			return async ({ result, update }) => {
				await update();
				applyingDiscount = false;
				if (result.type === 'redirect') {
					addToast('Discount applied');
					showDiscountModal = false;
				} else {
					addToast('Failed to apply discount', 'error');
				}
			};
		}} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="discount-percentage">Discount percentage</Label>
				<div class="relative">
					<Input
						id="discount-percentage"
						name="percentage"
						type="number"
						min="1"
						max="100"
						step="1"
						placeholder="10"
						bind:value={discountPercentage}
						class="pr-8"
						required
					/>
					<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={applyingDiscount} onclick={() => showDiscountModal = false}>Cancel</Button>
				<Button type="submit" disabled={applyingDiscount || !discountPercentage}>
					{#if applyingDiscount}{@render spinner()}{/if}
					{applyingDiscount ? 'Applying…' : 'Apply Discount'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Cancel dialog -->
<Dialog.Root bind:open={showCancelDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Cancel {order.name}?</Dialog.Title>
			<Dialog.Description>This cannot be undone.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/cancel" use:enhance={() => { submitting = 'cancel'; return async ({ result, update }) => { await update(); submitting = null; showCancelDialog = false; if (result.type === 'redirect') addToast('Order cancelled'); else addToast('Failed to cancel order', 'error'); }; }} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="reason">Reason</Label>
				<Select.Root type="single" name="reason" bind:value={cancelReason}>
					<Select.Trigger id="reason" class="w-full">{CANCEL_REASONS[cancelReason]}</Select.Trigger>
					<Select.Content>
						{#each Object.entries(CANCEL_REASONS) as [value, label]}
							<Select.Item {value} {label}>{label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1.5">
				<div class="flex items-center gap-1.5 text-sm">
					<input type="hidden" name="restock" value="true" />
					<Checkbox checked disabled />
					<span class="text-muted-foreground">Restock inventory (always on — cancelled orders can't skip restocking)</span>
				</div>
				<label class="flex items-center gap-1.5 text-sm cursor-pointer">
					<Checkbox name="notify" value="true" checked />
					Send a notification to the customer
				</label>
			</div>
			{#if order.displayFinancialStatus !== 'PENDING'}
				<label class="flex items-center gap-1.5 text-sm cursor-pointer">
					<Checkbox name="refund" value="true" />
					Refund payment
				</label>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'cancel'} onclick={() => showCancelDialog = false}>Keep Order</Button>
				<Button type="submit" variant="destructive" disabled={submitting === 'cancel'}>
					{#if submitting === 'cancel'}{@render spinner()}{/if}Cancel Order
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Fulfill dialog -->
<Dialog.Root bind:open={showFulfillDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Fulfill {order.name}</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/fulfill" use:enhance={() => { submitting = 'fulfill'; return async ({ result, update }) => { await update(); submitting = null; showFulfillDialog = false; if (result.type === 'redirect') addToast('Order fulfilled'); else addToast('Failed to fulfill order', 'error'); }; }} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="trackingCompany">Courier</Label>
				<Select.Root type="single" name="trackingCompany" bind:value={trackingCompany}>
					<Select.Trigger id="trackingCompany" class="w-full">{COURIER_OPTIONS[trackingCompany]}</Select.Trigger>
					<Select.Content>
						{#each Object.entries(COURIER_OPTIONS) as [value, label]}
							<Select.Item {value} {label}>{label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1.5">
				<Label for="trackingNumber">Tracking Number</Label>
				<Input id="trackingNumber" name="trackingNumber" class="font-mono" placeholder="Optional" />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'fulfill'} onclick={() => showFulfillDialog = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'fulfill'}>
					{#if submitting === 'fulfill'}{@render spinner()}{/if}Mark Fulfilled
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Lightbox bind:url={lightboxUrl} alt={lightboxAlt} />

<!-- Duplicate order dialog -->
<Dialog.Root bind:open={showDuplicateDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Duplicate {order.name}?</Dialog.Title>
			<Dialog.Description>Creates a new draft order with the same products, customer, and shipping address.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/duplicateOrder" use:enhance={() => { submitting = 'duplicate'; return async ({ result, update }) => { await update(); submitting = null; showDuplicateDialog = false; if (result.type === 'failure') addToast((result.data as any)?.error || 'Failed to duplicate order', 'error'); }; }}>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'duplicate'} onclick={() => showDuplicateDialog = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'duplicate'}>
					{#if submitting === 'duplicate'}{@render spinner()}{/if}Duplicate
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Confirm order dialog -->
<Dialog.Root bind:open={showConfirmDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Confirm {order.name}?</Dialog.Title>
			<Dialog.Description>Marks this order as confirmed with the customer. It can then be fulfilled.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/confirm" use:enhance={() => { submitting = 'confirm'; return async ({ result, update }) => { await update(); submitting = null; showConfirmDialog = false; if (result.type === 'redirect') addToast('Order confirmed'); else addToast('Failed to confirm order', 'error'); }; }}>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'confirm'} onclick={() => showConfirmDialog = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'confirm'}>
					{#if submitting === 'confirm'}{@render spinner()}{/if}Confirm Order
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Unconfirm order dialog -->
<Dialog.Root bind:open={showUnconfirmDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Unconfirm {order.name}?</Dialog.Title>
			<Dialog.Description>Removes the confirmed status. Order moves back to Pending and can't be fulfilled until reconfirmed.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/unconfirm" use:enhance={() => { submitting = 'unconfirm'; return async ({ result, update }) => { await update(); submitting = null; showUnconfirmDialog = false; if (result.type === 'redirect') addToast('Order unconfirmed'); else addToast('Failed to unconfirm order', 'error'); }; }}>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'unconfirm'} onclick={() => showUnconfirmDialog = false}>Cancel</Button>
				<Button type="submit" variant="destructive" disabled={submitting === 'unconfirm'}>
					{#if submitting === 'unconfirm'}{@render spinner()}{/if}Unconfirm Order
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Unbook / Unfulfill dialog -->
<Dialog.Root bind:open={showUnbookDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{data.booking ? 'Unbook & unfulfill' : 'Unfulfill'} {order.name}?</Dialog.Title>
			<Dialog.Description>
				{#if data.booking}
					Cancels the shipment with the courier and reverts the order back to unfulfilled in Shopify.
				{:else}
					Reverts the order back to unfulfilled in Shopify. There's no local booking record for this order, so no courier is contacted.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/unbook"
			use:enhance={() => {
				submitting = 'unbook';
				return async ({ result, update }) => {
					await update();
					submitting = null;
					showUnbookDialog = false;
					if (result.type === 'success') {
						const warning = (result.data as { warning?: string } | undefined)?.warning;
						addToast(warning ?? (data.booking ? 'Booking cancelled' : 'Order unfulfilled'), warning ? 'error' : 'success');
					} else {
						addToast(data.booking ? 'Failed to cancel booking' : 'Failed to unfulfill order', 'error');
					}
				};
			}}
		>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'unbook'} onclick={() => showUnbookDialog = false}>Never mind</Button>
				<Button type="submit" variant="destructive" disabled={submitting === 'unbook'}>
					{#if submitting === 'unbook'}{@render spinner()}{/if}{data.booking ? 'Unbook & Unfulfill' : 'Unfulfill'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Mark as paid dialog -->
<Dialog.Root bind:open={showMarkPaidDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Mark as Paid?</Dialog.Title>
			<Dialog.Description>This will record a manual payment of <strong>{formatCurrency(order.totalPriceSet.shopMoney.amount, order.totalPriceSet.shopMoney.currencyCode)}</strong> on {order.name}. This cannot be undone.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/markAsPaid" use:enhance={() => { submitting = 'markAsPaid'; return async ({ result, update }) => { await update(); submitting = null; showMarkPaidDialog = false; if (result.type === 'success' || result.type === 'redirect') addToast('Order marked as paid'); else addToast('Failed to mark as paid', 'error'); }; }}>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'markAsPaid'} onclick={() => showMarkPaidDialog = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'markAsPaid'}>
					{#if submitting === 'markAsPaid'}{@render spinner()}{/if}Confirm
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Invoice dialog -->
<Dialog.Root bind:open={showInvoiceDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Resend Invoice</Dialog.Title>
			<Dialog.Description>Invoice will be sent to this email.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/resendInvoice" use:enhance={() => { submitting = 'invoice'; return async ({ result, update }) => { await update(); submitting = null; showInvoiceDialog = false; if (result.type === 'success') addToast('Invoice sent'); else addToast(result.type === 'failure' && (result.data as any)?.error || 'Failed to send invoice', 'error'); }; }} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="invoiceEmail">Email</Label>
				<Input id="invoiceEmail" name="email" type="email" value={order.customer?.email ?? ''} required />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'invoice'} onclick={() => showInvoiceDialog = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'invoice'}>
					{#if submitting === 'invoice'}{@render spinner()}{/if}Send Invoice
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Refund dialog -->
<Dialog.Root bind:open={showRefundDialog}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Refund Items</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/refund" use:enhance={() => { submitting = 'refund'; return async ({ result, update }) => { await update(); submitting = null; showRefundDialog = false; if (result.type === 'redirect') addToast('Refund submitted'); else addToast('Failed to submit refund', 'error'); }; }} class="space-y-4">
			<div class="space-y-2">
				{#each activeLineItems as item}
					<div class="flex items-center gap-3 border border-border rounded-lg px-4 py-3">
						<input type="hidden" name="lineItemId" value={item.id} />
						<div class="flex-1 text-sm">
							<div class="font-medium">{item.title}</div>
							<div class="text-xs text-muted-foreground">Ordered: {item.currentQuantity}</div>
						</div>
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground">Qty</Label>
							<Input name="quantity" type="number" min="0" max={item.currentQuantity} value={item.currentQuantity} class="w-16 text-center h-8" />
						</div>
					</div>
				{/each}
			</div>
			<div class="space-y-1.5">
				<Label for="note">Note</Label>
				<Input id="note" name="note" placeholder="Reason for refund" />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={submitting === 'refund'} onclick={() => showRefundDialog = false}>Cancel</Button>
				<Button type="submit" disabled={submitting === 'refund'}>
					{#if submitting === 'refund'}{@render spinner()}{/if}Submit Refund
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
