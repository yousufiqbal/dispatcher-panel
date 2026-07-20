<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency } from '$lib/utils';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ImageIcon from '@lucide/svelte/icons/image';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const storeId = $derived($page.params.storeId);
	const orderId = $derived($page.params.orderId);
	const order = $derived(data.order);

	let quantities = $state<Record<string, number>>(
		Object.fromEntries(order.lineItems.nodes.map(i => [i.id, i.quantity]))
	);

	interface NewItem { variantId: string; title: string; price: string; qty: number; img?: string }
	let newItems = $state<NewItem[]>([]);
	let productSearch = $state('');
	let productResults = $state<{ id: string; title: string; featuredImage?: { url: string } | null; variants: { nodes: { id: string; title: string; price: string; sku: string | null }[] } }[]>([]);
	let searching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;

	let notifyCustomer = $state(false);

	// Track applied discounts per lineItemId
	let appliedDiscounts = $state<Record<string, { value: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; desc: string }>>({});

	// Bulk discount modal — lists every item at once so several discounts can be
	// set/edited/cleared in one pass instead of opening a dialog per item.
	// Selections default lazily from appliedDiscounts in the template rather than
	// being pre-populated on open, so rendering never depends on that timing.
	let showDiscountModal = $state(false);
	let discountSelections = $state<Record<string, { checked: boolean; percent: string }>>({});

	function defaultSelection(itemId: string): { checked: boolean; percent: string } {
		const existing = appliedDiscounts[itemId];
		return { checked: !!existing, percent: existing?.type === 'PERCENTAGE' ? existing.value : '' };
	}

	function openDiscountModal() {
		discountSelections = {};
		showDiscountModal = true;
	}

	function applyDiscountSelections() {
		const next = { ...appliedDiscounts };
		for (const item of order.lineItems.nodes) {
			const sel = discountSelections[item.id] ?? defaultSelection(item.id);
			if (sel.checked && sel.percent && parseFloat(sel.percent) > 0) {
				next[item.id] = { value: sel.percent, type: 'PERCENTAGE', desc: '' };
			} else {
				delete next[item.id];
			}
		}
		appliedDiscounts = next;
		showDiscountModal = false;
	}

	function discountedPrice(itemId: string, unitPrice: string, qty: number): number {
		const base = parseFloat(unitPrice) * qty;
		const d = appliedDiscounts[itemId];
		if (!d || !d.value || parseFloat(d.value) === 0) return base;
		if (d.type === 'PERCENTAGE') return base - base * (parseFloat(d.value) / 100);
		return Math.max(0, base - parseFloat(d.value));
	}

	const currency = $derived(order.totalPriceSet.shopMoney.currencyCode);
	const paid = $derived(parseFloat(order.totalPriceSet.shopMoney.amount));

	const updatedTotal = $derived(() => {
		let total = 0;
		for (const item of order.lineItems.nodes) {
			const qty = quantities[item.id] ?? 0;
			total += discountedPrice(item.id, item.originalUnitPriceSet.shopMoney.amount, qty);
		}
		for (const item of newItems) {
			total += parseFloat(item.price) * item.qty;
		}
		return Math.max(0, total);
	});

	const toCollect = $derived(Math.max(0, updatedTotal() - paid));

	async function searchProducts() {
		if (!productSearch.trim()) { productResults = []; return; }
		searching = true;
		try {
			const res = await fetch(`/api/shopify/${storeId}/products?q=${encodeURIComponent(productSearch)}`);
			if (res.ok) {
				productResults = await res.json();
			} else {
				const err = await res.text();
				console.error('[product search]', res.status, err);
			}
		} catch (e) {
			console.error('[product search fetch error]', e);
		} finally {
			searching = false;
		}
	}

	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(searchProducts, 350);
	}

	function addVariant(v: { id: string; title: string; price: string }, productTitle: string, img?: string) {
		const existing = newItems.find(i => i.variantId === v.id);
		if (existing) { existing.qty++; newItems = [...newItems]; }
		else newItems = [...newItems, { variantId: v.id, title: `${productTitle}${v.title !== 'Default Title' ? ' — ' + v.title : ''}`, price: v.price, qty: 1, img }];
		productSearch = '';
		productResults = [];
	}

	function removeNewItem(idx: number) { newItems = newItems.filter((_, i) => i !== idx); }
</script>

<svelte:head><title>Edit {order.name}</title></svelte:head>

<div class="p-3 sm:p-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<a href="/dispatcher/stores/{storeId}/orders/{orderId}" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 w-fit">
				<ArrowLeftIcon class="size-4" />
				Back to {order.name}
			</a>
			<h1 class="text-xl font-bold">Edit Items</h1>
			<p class="text-xs text-muted-foreground mt-0.5">Set quantity to 0 to remove an item</p>
		</div>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.error}</div>
	{/if}

	<form method="POST" action="?/saveItems" use:enhance class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
		<div class="lg:col-span-2 flex flex-col gap-5">

		<!-- Current items -->
		<div class="card overflow-hidden">
			<div class="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
				<div>
					<h2 class="font-semibold text-sm">Current Items</h2>
					<p class="text-xs text-muted-foreground mt-0.5">Set quantity to 0 to remove</p>
				</div>
				<Button type="button" variant="outline" size="sm" onclick={openDiscountModal}>Add Discount</Button>
			</div>
			<div class="divide-y divide-border">
				{#each order.lineItems.nodes as item}
					{@const img = item.image?.url ?? item.variant?.image?.url}
					<input type="hidden" name="lineItemId" value={item.id} />
					<div class="flex items-center gap-4 px-5 py-4">
						<!-- Image -->
						{#if img}
							<img src={img} alt={item.title} class="size-14 rounded-lg object-cover border border-border shrink-0" />
						{:else}
							<div class="size-14 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
								<ImageIcon class="size-5 text-muted-foreground" />
							</div>
						{/if}

						<!-- Info -->
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm text-foreground">{item.title}</div>
							{#if item.variant?.title && item.variant.title !== 'Default Title'}
								<div class="text-xs text-muted-foreground">{item.variant.title}</div>
							{/if}
							{#if item.variant?.sku}
								<div class="text-xs text-muted-foreground font-mono">SKU: {item.variant.sku}</div>
							{/if}
							<div class="text-xs text-muted-foreground mt-0.5">
								{formatCurrency(item.originalUnitPriceSet.shopMoney.amount, item.originalUnitPriceSet.shopMoney.currencyCode)} each
							</div>
						</div>

						<!-- Price (clickable for discount) + qty -->
						<div class="flex items-center gap-3 shrink-0">
							<div class="text-sm font-medium text-right min-w-[80px]">
								{#if appliedDiscounts[item.id]}
									<span class="line-through text-muted-foreground text-xs block">
										{formatCurrency((parseFloat(item.originalUnitPriceSet.shopMoney.amount) * (quantities[item.id] ?? 0)).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
									</span>
									<span class="text-foreground">
										{formatCurrency(discountedPrice(item.id, item.originalUnitPriceSet.shopMoney.amount, quantities[item.id] ?? 0).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
									</span>
									<span class="text-[10px] font-semibold text-green-700 block">−{appliedDiscounts[item.id].value}%</span>
								{:else}
									<span class="text-foreground">
										{formatCurrency((parseFloat(item.originalUnitPriceSet.shopMoney.amount) * (quantities[item.id] ?? 0)).toFixed(2), item.originalUnitPriceSet.shopMoney.currencyCode)}
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								<Button type="button" variant="outline" size="icon" class="size-8" onclick={() => quantities[item.id] = Math.max(0, (quantities[item.id] ?? 1) - 1)}>−</Button>
								<Input type="number" name="quantity" bind:value={quantities[item.id]} min="0" max="999" class="w-14 text-center h-8 text-sm font-medium" />
								<Button type="button" variant="outline" size="icon" class="size-8" onclick={() => quantities[item.id] = (quantities[item.id] ?? 0) + 1}>+</Button>
							</div>
							<Button type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" onclick={() => quantities[item.id] = 0} title="Remove">
								<XIcon class="size-4" />
							</Button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Add products -->
		<div class="card" style="order: -1">
			<div class="px-5 py-3 border-b border-border bg-muted/30">
				<h2 class="font-semibold text-sm">Add Products</h2>
			</div>
			<div class="px-5 py-4 space-y-3">
				<div class="relative">
					<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input type="text" class="pl-9" placeholder="Search products by name…"
						bind:value={productSearch} oninput={onSearchInput} />
					{#if searching}
						<Loader2Icon class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
					{/if}

					{#if productResults.length > 0}
						<div class="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
							{#each productResults as product}
								<div class="border-b border-border last:border-0">
									<div class="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">{product.title}</div>
									{#each product.variants.nodes as variant}
										<button type="button"
											onclick={() => addVariant(variant, product.title, product.featuredImage?.url)}
											class="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3 cursor-pointer"
										>
											<div class="flex items-center gap-2">
												{#if product.featuredImage?.url}
													<img src={product.featuredImage.url} alt={product.title} class="size-8 rounded object-cover border border-border shrink-0" />
												{/if}
												<span>{variant.title !== 'Default Title' ? variant.title : product.title}{variant.sku ? ` · ${variant.sku}` : ''}</span>
											</div>
											<span class="text-muted-foreground font-medium shrink-0">{formatCurrency(variant.price, 'PKR')}</span>
										</button>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if newItems.length > 0}
					<div class="space-y-2">
						{#each newItems as item, i}
							<input type="hidden" name="newVariantId" value={item.variantId} />
							<div class="flex items-center gap-3 border border-border rounded-xl px-4 py-3 bg-primary/5 border-primary/30">
								{#if item.img}
									<img src={item.img} alt={item.title} class="size-10 rounded-lg object-cover border border-border shrink-0" />
								{/if}
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium truncate">{item.title}</div>
									<div class="text-xs text-muted-foreground">{formatCurrency(item.price, 'PKR')} each</div>
								</div>
								<div class="flex items-center gap-3 shrink-0">
									<span class="text-sm font-medium text-foreground min-w-[70px] text-right">
										{formatCurrency((parseFloat(item.price) * item.qty).toFixed(2), 'PKR')}
									</span>
									<div class="flex items-center gap-1">
										<Button type="button" variant="outline" size="icon" class="size-7" onclick={() => item.qty > 1 ? item.qty-- : removeNewItem(i)}>−</Button>
										<Input type="number" name="newQty" bind:value={item.qty} min="1" class="w-14 text-center h-8 text-sm" />
										<Button type="button" variant="outline" size="icon" class="size-7" onclick={() => item.qty++}>+</Button>
									</div>
									<Button type="button" variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" onclick={() => removeNewItem(i)}>
										<XIcon class="size-4" />
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Hidden discount inputs for form submission -->
		{#each Object.entries(appliedDiscounts) as [lineItemId, d]}
			<input type="hidden" name="discountLineItemId" value={lineItemId} />
			<input type="hidden" name="discountValue" value={d.value} />
			<input type="hidden" name="discountType" value={d.type} />
			<input type="hidden" name="discountDesc" value={d.desc} />
			<input type="hidden" name="currencyCode" value={currency} />
		{/each}

		</div><!-- end left col -->

		<!-- RIGHT: Sticky summary -->
		<div class="sticky top-4 space-y-4">
			<div class="card p-5 space-y-4">
				<h2 class="font-semibold text-sm">Summary</h2>

				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Updated total</span>
						<span class="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(updatedTotal())}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Paid</span>
						<span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(paid)}</span>
					</div>
					<div class="flex justify-between font-semibold text-base border-t border-border pt-2">
						<span>Amount to collect</span>
						<span class="{toCollect > 0 ? 'text-destructive' : 'text-green-700'}">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(toCollect)}</span>
					</div>
				</div>

				<label class="flex items-center gap-3 cursor-pointer select-none">
					<Checkbox name="notifyCustomer" value="true" bind:checked={notifyCustomer} />
					<span class="text-sm">Send invoice to customer</span>
				</label>

				<Button type="submit" class="w-full">Update Order</Button>
				<Button href="/dispatcher/stores/{storeId}/orders/{orderId}" variant="outline" class="w-full">Cancel</Button>
			</div>
		</div>

	</form>
</div>

<!-- Bulk discount modal -->
<Dialog.Root bind:open={showDiscountModal}>
	<Dialog.Content class="sm:max-w-lg max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Add Discount</Dialog.Title>
			<Dialog.Description>Select the items to discount and set a percentage for each. Discounts are visible to the customer.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-2">
			{#if order.lineItems.nodes.length === 0}
				<p class="text-sm text-muted-foreground py-4 text-center">No items on this order.</p>
			{/if}
			{#each order.lineItems.nodes as item}
				{@const sel = discountSelections[item.id] ?? defaultSelection(item.id)}
				{@const existing = appliedDiscounts[item.id]}
				<label class="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5 {sel.checked ? 'border-primary/40 bg-primary/5' : ''}">
					<Checkbox checked={sel.checked} onCheckedChange={() => discountSelections[item.id] = { ...sel, checked: !sel.checked }} />
					<div class="min-w-0 flex-1">
						<div class="text-sm font-medium text-foreground truncate">{item.title}</div>
						<div class="text-xs text-muted-foreground">
							{formatCurrency(item.originalUnitPriceSet.shopMoney.amount, item.originalUnitPriceSet.shopMoney.currencyCode)} each
							{#if existing}
								<span class="text-green-700 font-medium">· current discount: {existing.type === 'PERCENTAGE' ? `${existing.value}%` : formatCurrency(existing.value, item.originalUnitPriceSet.shopMoney.currencyCode)}</span>
							{/if}
						</div>
					</div>
					<div class="relative w-24 shrink-0">
						<Input
							type="number"
							min="0"
							max="100"
							step="0.1"
							placeholder="0"
							class="pr-7 h-9 text-sm"
							disabled={!sel.checked}
							value={sel.percent}
							oninput={(e) => discountSelections[item.id] = { ...sel, percent: e.currentTarget.value }}
						/>
						<span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
					</div>
				</label>
			{/each}
		</div>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => showDiscountModal = false}>Cancel</Button>
			<Button type="button" onclick={applyDiscountSelections}>Apply</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
