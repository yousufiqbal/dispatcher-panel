<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const storeId = $derived($page.params.storeId);

	interface LineItem {
		variantId: string;
		title: string;
		price: string;
		quantity: number;
		sku: string;
	}

	let lineItems = $state<LineItem[]>([]);
	let productSearch = $state('');
	let productResults = $state<{ id: string; title: string; variants: { nodes: { id: string; title: string; price: string; sku: string | null }[] } }[]>([]);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let customerId = $state('');
	let discountValue = $state('');
	let discountType = $state<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
	let includeShipping = $state(false);

	const subtotal = $derived(
		lineItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
	);
	const discountAmount = $derived(() => {
		if (!discountValue || parseFloat(discountValue) === 0) return 0;
		if (discountType === 'PERCENTAGE') return subtotal * (parseFloat(discountValue) / 100);
		return Math.min(parseFloat(discountValue), subtotal);
	});
	const total = $derived(Math.max(0, subtotal - discountAmount()));

	async function searchProducts() {
		if (!productSearch.trim()) { productResults = []; return; }
		const res = await fetch(`/api/shopify/${storeId}/products?q=${encodeURIComponent(productSearch)}`);
		if (res.ok) productResults = await res.json();
	}

	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(searchProducts, 350);
	}

	function addVariant(variant: { id: string; title: string; price: string; sku: string | null }, productTitle: string) {
		const existing = lineItems.find((i) => i.variantId === variant.id);
		if (existing) {
			existing.quantity++;
			lineItems = [...lineItems];
		} else {
			lineItems = [...lineItems, {
				variantId: variant.id,
				title: `${productTitle} — ${variant.title}`,
				price: variant.price,
				quantity: 1,
				sku: variant.sku ?? ''
			}];
		}
		productSearch = '';
		productResults = [];
	}

	function addCustomItem() {
		lineItems = [...lineItems, { variantId: '', title: 'Custom Item', price: '0.00', quantity: 1, sku: '' }];
	}

	function removeItem(index: number) {
		lineItems = lineItems.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>New Order — Dispatcher Panel</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6">
		<a href="/dashboard/stores/{storeId}/orders" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Orders
		</a>
		<h1 class="text-2xl font-bold">Create New Order</h1>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{form.error}</div>
	{/if}

	<form method="POST" action="?/create" use:enhance class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="lg:col-span-2 space-y-6">
			<!-- Products -->
			<div class="card">
				<div class="card-header pb-3">
					<h2 class="text-base font-semibold">Products</h2>
				</div>
				<div class="card-content space-y-4">
					<!-- Product search -->
					<div class="relative">
						<input
							type="text"
							class="input"
							placeholder="Search products by name…"
							bind:value={productSearch}
							oninput={onSearchInput}
						/>
						{#if productResults.length > 0}
							<div class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
								{#each productResults as product}
									<div class="px-3 py-2 border-b border-border last:border-0">
										<div class="font-medium text-sm text-foreground mb-1">{product.title}</div>
										{#each product.variants.nodes as variant}
											<button
												type="button"
												onclick={() => addVariant(variant, product.title)}
												class="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted flex justify-between items-center"
											>
												<span>{variant.title} {variant.sku ? `(${variant.sku})` : ''}</span>
												<span class="text-muted-foreground">${variant.price}</span>
											</button>
										{/each}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Line items -->
					{#if lineItems.length > 0}
						<div class="space-y-2">
							{#each lineItems as item, i}
								<input type="hidden" name="variantId" value={item.variantId} />
								<div class="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
									<div class="flex-1 min-w-0">
										<input
											class="text-sm font-medium text-foreground bg-transparent border-0 p-0 w-full focus:outline-none focus:ring-0"
											bind:value={item.title}
											name="itemTitle"
										/>
										<div class="flex items-center gap-3 mt-1">
											<span class="text-xs text-muted-foreground">Price:</span>
											<input type="number" name="itemPrice" bind:value={item.price} step="0.01" min="0" class="text-xs border border-border rounded px-1 py-0.5 w-20" />
										</div>
									</div>
									<div class="flex items-center gap-2">
										<button type="button" onclick={() => item.quantity > 1 ? item.quantity-- : removeItem(i)} class="size-7 rounded border border-border text-muted-foreground hover:bg-muted text-center text-sm">−</button>
										<input type="number" name="itemQuantity" bind:value={item.quantity} min="1" class="w-12 text-center border border-border rounded px-1 py-0.5 text-sm" />
										<button type="button" onclick={() => item.quantity++} class="size-7 rounded border border-border text-muted-foreground hover:bg-muted text-center text-sm">+</button>
									</div>
									<button type="button" onclick={() => removeItem(i)} class="text-muted-foreground hover:text-destructive transition-colors">
										<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground text-center py-4">Search for products above or add a custom item</p>
					{/if}

					<button type="button" onclick={addCustomItem} class="btn-secondary btn-sm">
						+ Custom Item
					</button>
				</div>
			</div>

			<!-- Customer -->
			<div class="card">
				<div class="card-header pb-3">
					<h2 class="text-base font-semibold">Customer</h2>
				</div>
				<div class="card-content">
					<div class="space-y-1.5">
						<label class="label" for="customerId">Customer ID (Shopify GID)</label>
						<input id="customerId" name="customerId" class="input font-mono text-sm" placeholder="gid://shopify/Customer/123456789" bind:value={customerId} />
						<p class="text-xs text-muted-foreground">
							Find the customer first in the <a href="/dashboard/stores/{storeId}/customers" class="underline text-primary">Customers tab</a>, then copy their ID.
						</p>
					</div>
				</div>
			</div>

			<!-- Shipping address -->
			<div class="card">
				<div class="card-header pb-3">
					<div class="flex items-center justify-between">
						<h2 class="text-base font-semibold">Shipping Address</h2>
						<label class="flex items-center gap-2 text-sm cursor-pointer">
							<input type="checkbox" bind:checked={includeShipping} class="rounded" />
							Include
						</label>
					</div>
				</div>
				{#if includeShipping}
					<div class="card-content grid grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<label class="label">First Name</label>
							<input name="ship_firstName" class="input" required />
						</div>
						<div class="space-y-1.5">
							<label class="label">Last Name</label>
							<input name="ship_lastName" class="input" required />
						</div>
						<div class="col-span-2 space-y-1.5">
							<label class="label">Address</label>
							<input name="ship_address1" class="input" required />
						</div>
						<div class="space-y-1.5">
							<label class="label">City</label>
							<input name="ship_city" class="input" required />
						</div>
						<div class="space-y-1.5">
							<label class="label">Province</label>
							<input name="ship_province" class="input" />
						</div>
						<div class="space-y-1.5">
							<label class="label">Country</label>
							<input name="ship_country" class="input" value="PK" required />
						</div>
						<div class="space-y-1.5">
							<label class="label">ZIP</label>
							<input name="ship_zip" class="input" />
						</div>
						<div class="space-y-1.5">
							<label class="label">Phone</label>
							<input name="ship_phone" class="input" type="tel" />
						</div>
					</div>
				{/if}
			</div>

			<!-- Note -->
			<div class="card">
				<div class="card-content pt-6">
					<div class="space-y-1.5">
						<label class="label" for="note">Order Note</label>
						<textarea id="note" name="note" class="input min-h-20 resize-y" placeholder="Internal notes…"></textarea>
					</div>
				</div>
			</div>
		</div>

		<!-- Summary sidebar -->
		<div class="space-y-4">
			<div class="card p-5 space-y-4 sticky top-4">
				<h2 class="font-semibold">Order Summary</h2>

				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Subtotal</span>
						<span class="font-medium">${subtotal.toFixed(2)}</span>
					</div>

					{#if discountAmount() > 0}
						<div class="flex justify-between text-green-700">
							<span>Discount</span>
							<span>−${discountAmount().toFixed(2)}</span>
						</div>
					{/if}

					<div class="flex justify-between font-bold text-base border-t border-border pt-2">
						<span>Total</span>
						<span>${total.toFixed(2)}</span>
					</div>
				</div>

				<!-- Discount -->
				<div class="space-y-2 pt-2 border-t border-border">
					<label class="label text-xs">Discount</label>
					<div class="flex gap-2">
						<input type="number" name="discountValue" bind:value={discountValue} min="0" placeholder="0" class="input flex-1" />
						<select name="discountType" bind:value={discountType} class="input w-24">
							<option value="PERCENTAGE">%</option>
							<option value="FIXED_AMOUNT">Fixed</option>
						</select>
					</div>
				</div>

				<button type="submit" class="btn-primary w-full" disabled={lineItems.length === 0}>
					Create Order
				</button>
				<a href="/dashboard/stores/{storeId}/orders" class="btn-secondary w-full text-center block">Cancel</a>
			</div>
		</div>
	</form>
</div>
