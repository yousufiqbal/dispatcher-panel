<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { addToast } from '$lib/toast.svelte';
	import { page } from '$app/stores';
	import { formatCurrency, formatDate } from '$lib/utils';
	import { deliveryPill } from '$lib/delivery-status';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon2 from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let lightboxUrl = $state<string | null>(null);
	let lightboxAlt = $state('');
	let showConfirmDialog = $state(false);
	let showUnconfirmDialog = $state(false);
	let showEditShippingModal = $state(false);
	// Phone/email copy feedback, same affordance as the orders list.
	let copiedField = $state<string | null>(null);
	function copyValue(value: string) {
		navigator.clipboard.writeText(value);
		copiedField = value;
		setTimeout(() => copiedField === value && (copiedField = null), 1200);
	}

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
			order.fulfillments.some((f) => f.trackingInfo.some((t) => t.number))
		)
	);
	const isConfirmed = $derived(order.tags.includes('Confirmed'));
	const customerPhone = $derived(order.customer?.phone ?? order.phone ?? order.shippingAddress?.phone);
	// currentQuantity 0 means the line item was fully removed via order editing —
	// Shopify's admin shows those separately in a "Removed" card.
	const activeLineItems = $derived(order.lineItems.nodes.filter((i) => i.currentQuantity > 0));
	const removedLineItems = $derived(order.lineItems.nodes.filter((i) => i.currentQuantity === 0));

	function itemImg(item: (typeof activeLineItems)[number]): string | undefined {
		return item.image?.url ?? item.variant?.image?.url ?? undefined;
	}

	// Feeds the packing-mode Lightbox: only items with a photo can be paged
	// through, in the same order they're listed so serial numbers ("2 / 5")
	// match what the dispatcher sees on the page.
	const lightboxItems = $derived(
		activeLineItems
			.filter((i) => itemImg(i))
			.map((i) => ({
				url: itemImg(i)!,
				alt: i.image?.altText ?? i.title,
				title: i.title,
				subtitle: i.variant?.title && i.variant.title !== 'Default Title' ? i.variant.title : null,
				quantity: i.currentQuantity
			}))
	);
	const lightboxIndexByItem = $derived.by(() => {
		const map = new Map<(typeof activeLineItems)[number], number>();
		let i = 0;
		for (const it of activeLineItems) {
			if (itemImg(it)) map.set(it, i++);
		}
		return map;
	});
	let lightboxIndex = $state(0);
	function openLightbox(item: (typeof activeLineItems)[number]) {
		lightboxIndex = lightboxIndexByItem.get(item) ?? 0;
		lightboxUrl = itemImg(item) ?? null;
		lightboxAlt = item.image?.altText ?? item.title;
	}

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

	function statusClass(financial: string, fulfillment: string) {
		if (financial === 'REFUNDED' || financial === 'VOIDED') return 'badge-cancelled';
		if (fulfillment === 'FULFILLED') return 'badge-fulfilled';
		if (financial === 'PENDING') return 'badge-pending';
		return 'badge-partial';
	}

	// --- Payment summary ---------------------------------------------------
	const summaryCurrency = $derived(order.totalPriceSet.shopMoney.currencyCode);
	// An edit that changed the total gets an "Original order" line, as in
	// Shopify's admin. Unedited orders skip it — it would just repeat Total.
	const originalTotal = $derived(parseFloat(order.originalTotalPriceSet?.shopMoney.amount ?? order.totalPriceSet.shopMoney.amount));
	const wasEdited = $derived(Math.abs(originalTotal - parseFloat(order.totalPriceSet.shopMoney.amount)) >= 0.005);
	const paidAmount = $derived(parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0'));
	const balance = $derived(
		order.totalOutstandingSet
			? parseFloat(order.totalOutstandingSet.shopMoney.amount)
			: parseFloat(order.totalPriceSet.shopMoney.amount) - paidAmount
	);
	const longDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

</script>

{#snippet spinner()}
	<Loader2Icon class="size-4 animate-spin" />
{/snippet}

{#snippet notesCard()}
	<div class="card">
		<div class="px-5 py-4 border-b border-border flex items-center justify-between">
			<h2 class="font-semibold text-sm">Notes</h2>
		</div>
		<div class="px-5 py-4">
			<p class="text-sm text-muted-foreground">{order.note || 'No notes from customer'}</p>
		</div>
	</div>
{/snippet}

{#snippet customerCard()}
	<!-- One dense line: name · address · phone · email, with the edit menu inline
	     instead of its own header bar. -->
	<div class="card px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
		{#if order.customer}
			<a
				href="/dispatcher/stores/{storeId}/customers/{order.customer.id.split('/').pop()}"
				class="font-semibold text-sm text-foreground hover:text-primary hover:underline"
			>{order.customer.displayName}</a>
			{#if order.customer.numberOfOrders > 0}
				<span class="text-muted-foreground -ml-3">({order.customer.numberOfOrders})</span>
			{/if}
		{:else}
			<span class="font-semibold text-sm text-foreground">Guest</span>
		{/if}

		{#if order.shippingAddress}
			{@const addr = order.shippingAddress}
			<span class="text-border">|</span>
			<span class="text-foreground/80 min-w-0">
				{addr.address1}{#if addr.address2}, {addr.address2}{/if},
				<span class="font-semibold text-foreground">{[addr.city, addr.province].filter(Boolean).join(', ')}</span>
			</span>
		{/if}

		{#if customerPhone}
			{@const phone = customerPhone}
			<span class="text-border">|</span>
			<span class="inline-flex items-center gap-1 font-mono">
				<a href="tel:{phone}" class="text-foreground/80 hover:text-primary hover:underline">{phone}</a>
				<button type="button" class="text-muted-foreground hover:text-primary" title="Copy phone number" onclick={() => copyValue(phone)}>
					{#if copiedField === phone}
						<CheckIcon2 class="size-3 text-green-600" />
					{:else}
						<CopyIcon class="size-3" />
					{/if}
				</button>
			</span>
		{/if}

		{#if order.customer?.email}
			{@const email = order.customer.email}
			<span class="text-border">|</span>
			<span class="inline-flex items-center gap-1 min-w-0">
				<a href="mailto:{email}" class="text-foreground/80 hover:text-primary hover:underline truncate">{email}</a>
				<button type="button" class="text-muted-foreground hover:text-primary shrink-0" title="Copy email" onclick={() => copyValue(email)}>
					{#if copiedField === email}
						<CheckIcon2 class="size-3 text-green-600" />
					{:else}
						<CopyIcon class="size-3" />
					{/if}
				</button>
			</span>
		{/if}

		{#if !isCancelled && order.shippingAddress}
			<button
				type="button"
				class="ml-auto shrink-0 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
				title="Edit shipping address"
				onclick={() => showEditShippingModal = true}
			>
				<PencilIcon class="size-3.5" />
				<span class="hidden sm:inline">Edit address</span>
			</button>
		{/if}
	</div>
{/snippet}

{#snippet tagsCard()}
	<div class="card">
		<div class="px-5 py-4 border-b border-border flex items-center justify-between">
			<h2 class="font-semibold text-sm">Tags</h2>
		</div>
		<div class="px-5 py-4">
			{#if order.tags.length}
				<div class="flex flex-wrap gap-1.5">
					{#each order.tags as tag}
						<span class="px-2 py-0.5 rounded-md bg-muted text-xs font-medium text-foreground">{tag}</span>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">No tags</p>
			{/if}
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
			<Button
				onclick={() => {
					if (window.history.length > 1) window.history.back();
					else goto(`/dispatcher/stores/${storeId}/confirmer`);
				}}
				variant="outline"
				size="icon"
				class="shrink-0"
				title="Back"
			>
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
				{#if !isFulfilled && !isConfirmed}
					<Button onclick={() => showConfirmDialog = true}>Confirm Order</Button>
				{/if}
				{#if isConfirmed && !isFulfilled}
					<Button variant="outline" onclick={() => showUnconfirmDialog = true}>Unconfirm Order</Button>
				{/if}
			</div>
		{/if}
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
	{/if}

	<!-- Customer sits full-width above Items and Tracking. -->
	{@render customerCard()}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

		<!-- Notes/Tags (mobile only — desktop copy is in the right column below) -->
		<div class="lg:hidden space-y-5">
			{@render notesCard()}
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
							{@const unitOriginal = parseFloat(item.originalUnitPriceSet.shopMoney.amount)}
							{@const unitDiscounted = parseFloat(item.discountedUnitPriceSet.shopMoney.amount)}
							{@const itemPct = unitOriginal > 0 && unitDiscounted < unitOriginal ? Math.round((1 - unitDiscounted / unitOriginal) * 100) : 0}
							<tr>
								<td class="px-5 py-3">
									<div class="flex items-center gap-3">
										{#if img}
											<button type="button" onclick={() => openLightbox(item)} class="shrink-0 cursor-zoom-in">
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
											<div class="flex items-center gap-1.5 mt-0.5">
												{#if item.variant?.title && item.variant.title !== 'Default Title'}
													<span class="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-semibold">{item.variant.title}</span>
												{/if}
												<span class="inline-block px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-xs font-semibold">×{item.currentQuantity}</span>
											</div>
											{#if item.variant?.sku}
												<div class="text-xs text-muted-foreground font-mono mt-0.5">SKU: {item.variant.sku}</div>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-5 py-3 text-right font-medium whitespace-nowrap">
									{#if itemPct > 0}
										<div class="inline-block mb-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">{itemPct}% off</div>
										<div class="line-through text-muted-foreground text-xs">
											{formatCurrency((unitOriginal * item.currentQuantity).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
										</div>
										<div class="text-green-700">
											{formatCurrency((unitDiscounted * item.currentQuantity).toFixed(2), item.discountedUnitPriceSet.shopMoney.currencyCode)}
										</div>
									{:else}
										{formatCurrency((unitOriginal * item.currentQuantity).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<!-- Mobile stacked list -->
				<div class="md:hidden divide-y divide-border">
					{#each activeLineItems as item}
						{@const img = item.image?.url ?? item.variant?.image?.url}
						{@const unitOriginal = parseFloat(item.originalUnitPriceSet.shopMoney.amount)}
						{@const unitDiscounted = parseFloat(item.discountedUnitPriceSet.shopMoney.amount)}
						{@const itemPct = unitOriginal > 0 && unitDiscounted < unitOriginal ? Math.round((1 - unitDiscounted / unitOriginal) * 100) : 0}
						<div class="px-4 py-3 flex items-start gap-3">
							{#if img}
								<button type="button" onclick={() => openLightbox(item)} class="shrink-0 cursor-zoom-in">
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
								<div class="flex items-center gap-1.5 mt-0.5">
									{#if item.variant?.title && item.variant.title !== 'Default Title'}
										<span class="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-semibold">{item.variant.title}</span>
									{/if}
									<span class="inline-block px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-xs font-semibold">×{item.currentQuantity}</span>
								</div>
								{#if item.variant?.sku}
									<div class="text-xs text-muted-foreground font-mono mt-0.5">SKU: {item.variant.sku}</div>
								{/if}
								<div class="flex items-center justify-end gap-2 mt-1.5">
									{#if itemPct > 0}
										<span class="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">{itemPct}% off</span>
										<span class="text-xs text-muted-foreground line-through">
											{formatCurrency((unitOriginal * item.currentQuantity).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
										</span>
										<span class="text-sm font-medium text-green-700">
											{formatCurrency((unitDiscounted * item.currentQuantity).toFixed(2), item.discountedUnitPriceSet.shopMoney.currencyCode)}
										</span>
									{:else}
										<span class="text-sm font-medium text-foreground">
											{formatCurrency((unitOriginal * item.currentQuantity).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
										</span>
									{/if}
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
				</div>
				<div class="text-sm divide-y divide-border">
					{#if wasEdited}
						<div class="px-5 py-3 grid grid-cols-[7rem_1fr_auto] items-center gap-x-3">
							<span class="text-muted-foreground">Original order</span>
							<span class="text-muted-foreground text-xs">{longDate(order.createdAt)}</span>
							<span class="text-right tabular-nums">{formatCurrency(originalTotal.toFixed(2), summaryCurrency)}</span>
						</div>
					{/if}

					<div class="px-5 py-3 space-y-1.5">
						<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-x-3">
							<span class="text-muted-foreground">Subtotal</span>
							<span class="text-muted-foreground text-xs">{activeLineItems.reduce((s, i) => s + i.currentQuantity, 0)} items</span>
							<span class="text-right tabular-nums">{formatCurrency(order.subtotalPriceSet?.shopMoney?.amount ?? '0', summaryCurrency)}</span>
						</div>
						{#each shippingDiscounts as sd}
							<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-x-3">
								<span class="text-muted-foreground">Discount</span>
								<span class="text-muted-foreground text-xs truncate">{sd.label}</span>
								<span class="text-right tabular-nums">-{formatCurrency(sd.amount.toFixed(2), summaryCurrency)}</span>
							</div>
						{/each}
						{#each order.shippingLines.nodes as line}
							<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-x-3">
								<span class="text-muted-foreground">Shipping</span>
								<span class="text-muted-foreground text-xs truncate">{line.title}</span>
								<span class="text-right tabular-nums">{formatCurrency(line.originalPriceSet.shopMoney.amount, summaryCurrency)}</span>
							</div>
						{/each}
						<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-x-3 font-bold">
							<span>Total</span>
							<span></span>
							<span class="text-right tabular-nums">{formatCurrency(order.totalPriceSet.shopMoney.amount, summaryCurrency)}</span>
						</div>
					</div>

					<div class="px-5 py-3 space-y-1.5">
						<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-x-3">
							<span class="text-muted-foreground">Paid</span>
							<span></span>
							<span class="text-right tabular-nums">{formatCurrency(paidAmount.toFixed(2), summaryCurrency)}</span>
						</div>
						<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-x-3">
							<span class="text-muted-foreground">Balance</span>
							<span>
								{#if balance > 0.005}
									<span class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-red-100 text-red-800">Due</span>
								{:else if balance < -0.005}
									<span class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">Refund owed</span>
								{/if}
							</span>
							<span class="text-right tabular-nums">{formatCurrency(Math.abs(balance).toFixed(2), summaryCurrency)}</span>
						</div>
					</div>
				</div>
			</div>

		</div>

		<!-- RIGHT COLUMN (desktop only): Tracking (if fulfilled), Notes, Tags -->
		<div class="hidden lg:flex lg:col-start-3 flex-col gap-5">
			{#if isFulfilled}
				{@const tracking = order.fulfillments.flatMap((f) => f.trackingInfo).find((t) => t.number)}
				<div class="card">
					<div class="px-5 py-4 border-b border-border">
						<h2 class="font-semibold text-sm">Tracking</h2>
					</div>
					<div class="px-5 py-4 space-y-2 text-sm">
						{#if tracking}
							<div class="font-medium text-foreground">{tracking.company ?? 'Unknown courier'}</div>
							<div class="text-muted-foreground font-mono">{tracking.number}</div>
							{#if delivery}
								<div>
									<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full {delivery.class}">
										<span class="size-1.5 rounded-full bg-current shrink-0"></span>
										{delivery.label}
									</span>
								</div>
							{/if}
							{#if tracking.url}
								<a href={tracking.url} target="_blank" rel="noopener" class="text-primary text-xs hover:underline block mt-1">Track shipment →</a>
							{/if}
						{:else}
							<span class="text-muted-foreground">No tracking info</span>
						{/if}
					</div>
				</div>
			{/if}
			{@render notesCard()}
			{@render tagsCard()}
		</div>
	</div>
</div>

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

<Lightbox bind:url={lightboxUrl} alt={lightboxAlt} items={lightboxItems} bind:index={lightboxIndex} />

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
