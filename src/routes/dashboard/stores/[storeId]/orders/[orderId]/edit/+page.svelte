<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatCurrency } from '$lib/utils';
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

	let discountLineItemId = $state(order.lineItems.nodes[0]?.id ?? '');
	let discountValue = $state('');
	let discountType = $state<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
	let discountDesc = $state('Discount');
	let showDiscount = $state(false);
	let notifyCustomer = $state(false);

	const currency = $derived(order.totalPriceSet.shopMoney.currencyCode);
	const paid = $derived(parseFloat(order.totalReceivedSet?.shopMoney?.amount ?? '0'));

	const updatedTotal = $derived(() => {
		let total = 0;
		for (const item of order.lineItems.nodes) {
			const qty = quantities[item.id] ?? 0;
			total += parseFloat(item.originalUnitPriceSet.shopMoney.amount) * qty;
		}
		for (const item of newItems) {
			total += parseFloat(item.price) * item.qty;
		}
		// apply discount if set
		if (discountValue && parseFloat(discountValue) > 0) {
			const dv = parseFloat(discountValue);
			if (discountType === 'PERCENTAGE') total -= total * (dv / 100);
			else total -= Math.min(dv, total);
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
			<a href="/dashboard/stores/{storeId}/orders/{orderId}" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 w-fit">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
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
		<div class="lg:col-span-2 space-y-5">

		<!-- Existing items -->
		<div class="card overflow-hidden">
			<div class="px-5 py-3 border-b border-border bg-muted/30">
				<h2 class="font-semibold text-sm">Current Items</h2>
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
								<svg class="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M4.5 3h15A1.5 1.5 0 0121 4.5v15a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19.5v-15A1.5 1.5 0 014.5 3z"/></svg>
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

						<!-- Qty controls -->
						<div class="flex items-center gap-2 shrink-0">
							<button type="button" onclick={() => quantities[item.id] = Math.max(0, (quantities[item.id] ?? 1) - 1)}
								class="size-8 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-lg font-light">−</button>
							<input type="number" name="quantity" bind:value={quantities[item.id]} min="0" max="999"
								class="input w-16 text-center h-8 text-sm font-medium" />
							<button type="button" onclick={() => quantities[item.id] = (quantities[item.id] ?? 0) + 1}
								class="size-8 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-lg font-light">+</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Add products -->
		<div class="card overflow-hidden">
			<div class="px-5 py-3 border-b border-border bg-muted/30">
				<h2 class="font-semibold text-sm">Add Products</h2>
			</div>
			<div class="px-5 py-4 space-y-3">
				<div class="relative">
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					<input type="text" class="input pl-9" placeholder="Search products by name…"
						bind:value={productSearch} oninput={onSearchInput} />
					{#if searching}
						<svg class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
						</svg>
					{/if}

					{#if productResults.length > 0}
						<div class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
							{#each productResults as product}
								<div class="border-b border-border last:border-0">
									<div class="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">{product.title}</div>
									{#each product.variants.nodes as variant}
										<button type="button"
											onclick={() => addVariant(variant, product.title, product.featuredImage?.url)}
											class="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3"
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
								<div class="flex items-center gap-2 shrink-0">
									<button type="button" onclick={() => item.qty > 1 ? item.qty-- : removeNewItem(i)}
										class="size-7 rounded-lg border border-border text-muted-foreground hover:bg-muted text-sm">−</button>
									<input type="number" name="newQty" bind:value={item.qty} min="1" class="input w-14 text-center h-8 text-sm" />
									<button type="button" onclick={() => item.qty++}
										class="size-7 rounded-lg border border-border text-muted-foreground hover:bg-muted text-sm">+</button>
									<button type="button" onclick={() => removeNewItem(i)} class="text-muted-foreground hover:text-destructive transition-colors ml-1">
										<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Discount (collapsible) -->
		<div class="card overflow-hidden">
			<button type="button" onclick={() => showDiscount = !showDiscount}
				class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
				<h2 class="font-semibold text-sm">Add Discount to Item</h2>
				<svg class="size-4 text-muted-foreground transition-transform duration-150 {showDiscount ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
				</svg>
			</button>
			{#if showDiscount}
				<div class="px-5 pb-5 space-y-3 border-t border-border pt-4">
					<div class="space-y-1.5">
						<label class="label text-xs">Apply to</label>
						<select name="discountLineItemId" bind:value={discountLineItemId} class="input">
							{#each order.lineItems.nodes as item}
								<option value={item.id}>{item.title}</option>
							{/each}
						</select>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<label class="label text-xs">Value</label>
							<input name="discountValue" type="number" min="0" step="0.01" class="input" placeholder="10" bind:value={discountValue} />
						</div>
						<div class="space-y-1.5">
							<label class="label text-xs">Type</label>
							<select name="discountType" bind:value={discountType} class="input">
								<option value="PERCENTAGE">Percentage (%)</option>
								<option value="FIXED_AMOUNT">Fixed Amount</option>
							</select>
						</div>
					</div>
					<div class="space-y-1.5">
						<label class="label text-xs">Description</label>
						<input name="discountDesc" class="input" placeholder="e.g. Loyalty discount" bind:value={discountDesc} />
					</div>
				</div>
			{/if}
		</div>

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
					<input type="checkbox" name="notifyCustomer" value="true" bind:checked={notifyCustomer} class="rounded size-4" />
					<span class="text-sm">Send invoice to customer</span>
				</label>

				<button type="submit" class="btn-primary w-full">Update Order</button>
				<a href="/dashboard/stores/{storeId}/orders/{orderId}" class="btn-secondary w-full text-center block">Cancel</a>
			</div>
		</div>

	</form>
</div>
