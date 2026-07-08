<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency, formatDate } from '$lib/utils';
	import { addToast } from '$lib/toast.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const draft = $derived(data.draft);
	const storeId = $derived($page.params.storeId);

	let showDeleteDialog = $state(false);
	let showCompleteDialog = $state(false);

	const statusColor = $derived(
		draft.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
		draft.status === 'INVOICE_SENT' ? 'bg-blue-100 text-blue-800' :
		'bg-amber-100 text-amber-800'
	);
</script>

<svelte:head>
	<title>Draft {draft.name}</title>
</svelte:head>

<div class="p-3 sm:p-6 space-y-4">

	<!-- Header -->
	<div class="flex items-start justify-between gap-4 flex-wrap">
		<div>
			<a href="/dispatcher/stores/{storeId}/orders?status=drafts" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3 w-fit">
				<ArrowLeftIcon class="size-4" />
				Drafts
			</a>
			<div class="flex items-center gap-3 flex-wrap">
				<h1 class="text-2xl font-bold">{draft.name}</h1>
				<span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full {statusColor}">
					<span class="size-1.5 rounded-full bg-current shrink-0"></span>
					{draft.status.replace(/_/g, ' ')}
				</span>
			</div>
			<p class="text-sm text-muted-foreground mt-1">{formatDate(draft.createdAt)}</p>
		</div>

		{#if draft.status !== 'COMPLETED'}
			<div class="flex items-center gap-2">
				<Button onclick={() => showCompleteDialog = true}>Complete Order</Button>
				<Button variant="destructive" onclick={() => showDeleteDialog = true}>Delete Draft</Button>
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

		<!-- LEFT -->
		<div class="lg:col-span-2 space-y-5">

			<!-- Line Items -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border">
					<h2 class="font-semibold text-sm">Items</h2>
				</div>
				<table class="w-full text-sm">
					<tbody class="divide-y divide-border">
						{#each draft.lineItems.nodes as item}
							<tr>
								<td class="px-5 py-3">
									<div class="font-medium text-foreground">{item.title}</div>
									{#if item.variant?.title && item.variant.title !== 'Default Title'}
										<div class="text-xs text-muted-foreground">{item.variant.title}</div>
									{/if}
									{#if item.variant?.sku}
										<div class="text-xs text-muted-foreground font-mono">SKU: {item.variant.sku}</div>
									{/if}
								</td>
								<td class="px-5 py-3 text-center text-muted-foreground">× {item.quantity}</td>
								<td class="px-5 py-3 text-right font-medium whitespace-nowrap">
									{formatCurrency((parseFloat(item.originalUnitPrice) * item.quantity).toFixed(2), 'PKR')}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Totals -->
			<div class="card overflow-hidden">
				<div class="divide-y divide-border text-sm">
					<div class="flex items-center justify-between px-5 py-3">
						<span class="text-muted-foreground">Subtotal</span>
						<span>{draft.subtotalPrice}</span>
					</div>
					<div class="flex items-center justify-between px-5 py-3 font-bold">
						<span>Total</span>
						<span>{draft.totalPrice}</span>
					</div>
				</div>
			</div>

			{#if draft.note}
				<div class="card px-5 py-4">
					<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Note</div>
					<p class="text-sm">{draft.note}</p>
				</div>
			{/if}
		</div>

		<!-- RIGHT -->
		<div class="space-y-5">

			<!-- Customer -->
			<div class="card">
				<div class="px-5 py-4 border-b border-border">
					<h2 class="font-semibold text-sm">Customer</h2>
				</div>
				<div class="px-5 py-4 space-y-1 text-sm">
					{#if draft.customer}
						<div class="font-medium">{draft.customer.displayName}</div>
						{#if draft.customer.email}<div class="text-muted-foreground">{draft.customer.email}</div>{/if}
						{#if draft.customer.phone}<div class="text-muted-foreground">{draft.customer.phone}</div>{/if}
					{:else}
						<span class="text-muted-foreground">No customer</span>
					{/if}
				</div>
			</div>

			<!-- Shipping Address -->
			{#if draft.shippingAddress}
				<div class="card">
					<div class="px-5 py-4 border-b border-border">
						<h2 class="font-semibold text-sm">Shipping Address</h2>
					</div>
					<div class="px-5 py-4">
						<address class="not-italic text-sm space-y-0.5">
							<div class="font-medium">{draft.shippingAddress.name}</div>
							<div class="text-muted-foreground">{draft.shippingAddress.address1}</div>
							<div class="text-muted-foreground">{draft.shippingAddress.city}, {draft.shippingAddress.province} {draft.shippingAddress.zip}</div>
							<div class="text-muted-foreground">{draft.shippingAddress.country}</div>
							{#if draft.shippingAddress.phone}
								<div class="text-muted-foreground">{draft.shippingAddress.phone}</div>
							{/if}
						</address>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Complete dialog -->
<Dialog.Root bind:open={showCompleteDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Complete {draft.name}?</Dialog.Title>
			<Dialog.Description>Converts this draft into a real order. Cannot be undone.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/complete" use:enhance={() => { showCompleteDialog = false; return async ({ result, update }) => { await update(); if (result.type === 'failure') addToast((result.data as any)?.error || 'Failed to complete order', 'error'); }; }}>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => showCompleteDialog = false}>Cancel</Button>
				<Button type="submit">Complete Order</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete dialog -->
<Dialog.Root bind:open={showDeleteDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete {draft.name}?</Dialog.Title>
			<Dialog.Description>This draft will be permanently deleted.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/delete" use:enhance={() => { showDeleteDialog = false; return async ({ result, update }) => { await update(); if (result.type === 'failure') addToast((result.data as any)?.error || 'Failed to delete draft', 'error'); }; }}>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => showDeleteDialog = false}>Cancel</Button>
				<Button type="submit" variant="destructive">Delete Draft</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
