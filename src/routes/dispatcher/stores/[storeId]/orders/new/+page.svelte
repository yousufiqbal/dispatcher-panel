<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);

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
	let discountValue = $state('');
	let discountType = $state<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
	let includeShipping = $state(false);

	// Customer selection
	interface CustomerResult {
		id: string;
		displayName: string;
		email: string | null;
		phone: string | null;
		numberOfOrders: number;
		defaultAddress: { address1: string | null; city: string | null; province: string | null; country: string | null; zip: string | null } | null;
	}
	let customerMode = $state<'existing' | 'new'>('existing');
	let selectedCustomer = $state<CustomerResult | null>(null);
	let customerSearch = $state('');
	let customerResults = $state<CustomerResult[]>([]);
	let customerSearching = $state(false);
	let customerSearchTimeout: ReturnType<typeof setTimeout>;
	// New-customer fields
	let custFirstName = $state('');
	let custLastName = $state('');
	let custPhone = $state('');
	let custEmail = $state('');
	// Shipping fields (bound so a selected customer can prefill them)
	let shipFirstName = $state('');
	let shipLastName = $state('');
	let shipAddress1 = $state('');
	let shipCity = $state('');
	let shipProvince = $state('');
	let shipCountry = $state('PK');
	let shipZip = $state('');
	let shipPhone = $state('');

	async function searchCustomers() {
		if (!customerSearch.trim()) { customerResults = []; return; }
		customerSearching = true;
		try {
			const res = await fetch(`/api/shopify/${storeId}/customers?q=${encodeURIComponent(customerSearch)}`);
			if (res.ok) customerResults = await res.json();
		} finally {
			customerSearching = false;
		}
	}

	function onCustomerSearchInput() {
		clearTimeout(customerSearchTimeout);
		customerSearchTimeout = setTimeout(searchCustomers, 350);
	}

	function selectCustomer(c: CustomerResult) {
		selectedCustomer = c;
		customerSearch = '';
		customerResults = [];
		// Prefill shipping from the customer's default address (only empty fields,
		// so a manually typed address isn't clobbered).
		const [first, ...rest] = c.displayName.split(' ');
		if (!shipFirstName) shipFirstName = first ?? '';
		if (!shipLastName) shipLastName = rest.join(' ');
		if (!shipPhone && c.phone) shipPhone = c.phone;
		if (c.defaultAddress) {
			if (!shipAddress1 && c.defaultAddress.address1) shipAddress1 = c.defaultAddress.address1;
			if (!shipCity && c.defaultAddress.city) shipCity = c.defaultAddress.city;
			if (!shipProvince && c.defaultAddress.province) shipProvince = c.defaultAddress.province;
			if (c.defaultAddress.country) shipCountry = c.defaultAddress.country;
			if (!shipZip && c.defaultAddress.zip) shipZip = c.defaultAddress.zip;
			includeShipping = true;
		}
	}

	function clearCustomer() {
		selectedCustomer = null;
	}

	// New-customer name/phone doubles as the shipping recipient when empty.
	function syncNewCustomerToShipping() {
		if (!shipFirstName) shipFirstName = custFirstName;
		if (!shipLastName) shipLastName = custLastName;
		if (!shipPhone) shipPhone = custPhone;
	}

	let shippingCharge = $state('');
	let shippingTitle = $state('');

	const subtotal = $derived(
		lineItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
	);
	const discountAmount = $derived(() => {
		if (!discountValue || parseFloat(discountValue) === 0) return 0;
		if (discountType === 'PERCENTAGE') return subtotal * (parseFloat(discountValue) / 100);
		return Math.min(parseFloat(discountValue), subtotal);
	});
	const shippingChargeNum = $derived(parseFloat(shippingCharge) || 0);
	const total = $derived(Math.max(0, subtotal - discountAmount()) + shippingChargeNum);

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
	<title>New Order — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6">
		<a href="/dispatcher/stores/{storeId}/orders" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
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

	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				await update();
				submitting = false;
				if (result.type === 'redirect') addToast('Order created');
			};
		}}
		class="grid grid-cols-1 lg:grid-cols-3 gap-6"
	>
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
												<span class="text-muted-foreground">Rs {variant.price}</span>
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
					<div class="flex items-center justify-between">
						<h2 class="text-base font-semibold">Customer</h2>
						<div class="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
							<button
								type="button"
								class="px-3 py-1.5 transition-colors {customerMode === 'existing' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground hover:bg-muted'}"
								onclick={() => { customerMode = 'existing'; }}
							>Existing</button>
							<button
								type="button"
								class="px-3 py-1.5 transition-colors {customerMode === 'new' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground hover:bg-muted'}"
								onclick={() => { customerMode = 'new'; clearCustomer(); }}
							>New Customer</button>
						</div>
					</div>
				</div>
				<div class="card-content space-y-4">
					{#if customerMode === 'existing'}
						<input type="hidden" name="customerId" value={selectedCustomer?.id ?? ''} />
						{#if selectedCustomer}
							<div class="flex items-start justify-between gap-3 border border-border rounded-lg px-4 py-3">
								<div class="text-sm">
									<div class="font-medium text-foreground">{selectedCustomer.displayName}</div>
									{#if selectedCustomer.phone}<div class="text-muted-foreground text-xs mt-0.5">{selectedCustomer.phone}</div>{/if}
									{#if selectedCustomer.email}<div class="text-muted-foreground text-xs">{selectedCustomer.email}</div>{/if}
									<div class="text-xs text-muted-foreground mt-0.5">{selectedCustomer.numberOfOrders} previous order{selectedCustomer.numberOfOrders === 1 ? '' : 's'}</div>
								</div>
								<button type="button" class="text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Remove customer" onclick={clearCustomer}>
									<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{:else}
							<div class="relative">
								<svg class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
								<input
									type="text"
									class="input pl-9"
									placeholder="Search by name, phone, or email…"
									bind:value={customerSearch}
									oninput={onCustomerSearchInput}
								/>
								{#if customerSearching}
									<div class="absolute right-3 top-1/2 -translate-y-1/2">
										<svg class="size-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
										</svg>
									</div>
								{/if}
								{#if customerResults.length > 0}
									<div class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
										{#each customerResults as c}
											<button
												type="button"
												class="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
												onclick={() => selectCustomer(c)}
											>
												<div class="text-sm font-medium text-foreground">{c.displayName}</div>
												<div class="text-xs text-muted-foreground">
													{[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
													· {c.numberOfOrders} order{c.numberOfOrders === 1 ? '' : 's'}
												</div>
											</button>
										{/each}
									</div>
								{:else if customerSearch.trim() && !customerSearching}
									<div class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 px-3 py-2.5 text-sm text-muted-foreground">
										No customers found —
										<button type="button" class="text-primary hover:underline" onclick={() => { customerMode = 'new'; }}>create a new one</button>
									</div>
								{/if}
							</div>
							<p class="text-xs text-muted-foreground">Leave empty for a guest order.</p>
						{/if}
					{:else}
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-1.5">
								<label class="label" for="cust_firstName">First Name <span class="text-destructive">*</span></label>
								<input id="cust_firstName" name="cust_firstName" class="input" bind:value={custFirstName} onblur={syncNewCustomerToShipping} required />
							</div>
							<div class="space-y-1.5">
								<label class="label" for="cust_lastName">Last Name</label>
								<input id="cust_lastName" name="cust_lastName" class="input" bind:value={custLastName} onblur={syncNewCustomerToShipping} />
							</div>
							<div class="space-y-1.5">
								<label class="label" for="cust_phone">Phone</label>
								<input id="cust_phone" name="cust_phone" type="tel" class="input" placeholder="03XXXXXXXXX" bind:value={custPhone} onblur={syncNewCustomerToShipping} />
							</div>
							<div class="space-y-1.5">
								<label class="label" for="cust_email">Email</label>
								<input id="cust_email" name="cust_email" type="email" class="input" bind:value={custEmail} />
							</div>
						</div>
						<p class="text-xs text-muted-foreground">Customer is created in Shopify along with the order. The shipping address below is saved as their address.</p>
					{/if}
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
							<label class="label" for="ship_firstName">First Name</label>
							<input id="ship_firstName" name="ship_firstName" class="input" bind:value={shipFirstName} required />
						</div>
						<div class="space-y-1.5">
							<label class="label" for="ship_lastName">Last Name</label>
							<input id="ship_lastName" name="ship_lastName" class="input" bind:value={shipLastName} required />
						</div>
						<div class="col-span-2 space-y-1.5">
							<label class="label" for="ship_address1">Address</label>
							<input id="ship_address1" name="ship_address1" class="input" bind:value={shipAddress1} required />
						</div>
						<div class="space-y-1.5">
							<label class="label" for="ship_city">City</label>
							<input id="ship_city" name="ship_city" class="input" bind:value={shipCity} required />
						</div>
						<div class="space-y-1.5">
							<label class="label" for="ship_province">Province</label>
							<input id="ship_province" name="ship_province" class="input" bind:value={shipProvince} />
						</div>
						<div class="space-y-1.5">
							<label class="label" for="ship_country">Country</label>
							<input id="ship_country" name="ship_country" class="input" bind:value={shipCountry} required />
						</div>
						<div class="space-y-1.5">
							<label class="label" for="ship_zip">ZIP</label>
							<input id="ship_zip" name="ship_zip" class="input" bind:value={shipZip} />
						</div>
						<div class="space-y-1.5">
							<label class="label" for="ship_phone">Phone</label>
							<input id="ship_phone" name="ship_phone" class="input" type="tel" bind:value={shipPhone} />
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
						<span class="font-medium">Rs {subtotal.toFixed(2)}</span>
					</div>

					{#if discountAmount() > 0}
						<div class="flex justify-between text-green-700">
							<span>Discount</span>
							<span>−Rs {discountAmount().toFixed(2)}</span>
						</div>
					{/if}

					{#if shippingChargeNum > 0}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Shipping</span>
							<span>Rs {shippingChargeNum.toFixed(2)}</span>
						</div>
					{/if}

					<div class="flex justify-between font-bold text-base border-t border-border pt-2">
						<span>Total</span>
						<span>Rs {total.toFixed(2)}</span>
					</div>
				</div>

				<!-- Discount -->
				<div class="space-y-2 pt-2 border-t border-border">
					<label class="label text-xs" for="discountValue">Discount</label>
					<div class="flex gap-2">
						<input id="discountValue" type="number" name="discountValue" bind:value={discountValue} min="0" placeholder="0" class="input flex-1" />
						<select name="discountType" bind:value={discountType} class="input w-24">
							<option value="PERCENTAGE">%</option>
							<option value="FIXED_AMOUNT">Fixed</option>
						</select>
					</div>
				</div>

				<!-- Shipping charge -->
				<div class="space-y-2 pt-2 border-t border-border">
					<label class="label text-xs" for="shippingCharge">Shipping Charge</label>
					<div class="flex gap-2">
						<input id="shippingCharge" type="number" name="shippingCharge" bind:value={shippingCharge} min="0" step="0.01" placeholder="0" class="input w-28" />
						<input type="text" name="shippingTitle" bind:value={shippingTitle} placeholder="Shipping" class="input flex-1" />
					</div>
				</div>

				<button type="submit" class="btn-primary w-full inline-flex items-center justify-center gap-2" disabled={submitting || lineItems.length === 0}>
					{#if submitting}
						<svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
						</svg>
					{/if}
					{submitting ? 'Creating…' : 'Create Order'}
				</button>
				<a href="/dispatcher/stores/{storeId}/orders" class="btn-secondary w-full text-center block">Cancel</a>
			</div>
		</div>
	</form>
</div>
