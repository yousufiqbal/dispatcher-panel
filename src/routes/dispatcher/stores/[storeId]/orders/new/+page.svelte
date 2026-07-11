<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { clickOutside } from '$lib/actions/clickOutside';
	import { shopifyIdToNumber } from '$lib/utils';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	const storeId = $derived($page.params.storeId);

	// Products
	interface LineItem {
		variantId: string;
		productTitle: string;
		variantTitle: string;
		price: string;
		sku: string | null;
		image: string | null;
		quantity: number;
		inventoryQuantity: number | null;
		discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
		discountValue: number;
		discountReason: string;
	}

	function lineItemUnitPrice(item: LineItem): number {
		const price = parseFloat(item.price);
		if (!item.discountType || !item.discountValue) return price;
		if (item.discountType === 'PERCENTAGE') return Math.max(0, price * (1 - item.discountValue / 100));
		return Math.max(0, price - item.discountValue);
	}
	interface ProductVariant {
		id: string;
		title: string;
		price: string;
		sku: string | null;
		inventoryQuantity: number | null;
	}
	interface ProductResult {
		id: string;
		title: string;
		featuredImage?: { url: string } | null;
		variants: { nodes: ProductVariant[] };
	}

	let lineItems = $state<LineItem[]>([]);
	let showProductModal = $state(false);
	let productModalSearch = $state('');
	let productModalResults = $state<ProductResult[]>([]);
	let productModalLoading = $state(false);
	let productSearchTimeout: ReturnType<typeof setTimeout>;
	let productSearchToken = 0;
	// Keyed by variant id, not derived from productModalResults — a later search
	// replaces productModalResults, which previously lost earlier checked variants'
	// details (title/price/image) even though their id stayed in a checked-ids Set.
	let checkedVariants = $state<Map<string, LineItem>>(new Map());

	function openProductModal() {
		productModalSearch = '';
		productModalResults = [];
		checkedVariants = new Map();
		showProductModal = true;
		searchProductModal();
	}

	async function searchProductModal() {
		const token = ++productSearchToken;
		productModalLoading = true;
		try {
			const res = await fetch(`/api/shopify/${storeId}/products?q=${encodeURIComponent(productModalSearch)}`);
			if (token !== productSearchToken) return; // a newer search superseded this one
			if (res.ok) productModalResults = await res.json();
		} finally {
			if (token === productSearchToken) productModalLoading = false;
		}
	}

	function onProductModalInput() {
		clearTimeout(productSearchTimeout);
		productSearchTimeout = setTimeout(searchProductModal, 300);
	}

	function toggleVariant(product: ProductResult, v: ProductVariant) {
		const next = new Map(checkedVariants);
		if (next.has(v.id)) {
			next.delete(v.id);
		} else {
			next.set(v.id, {
				variantId: v.id,
				productTitle: product.title,
				variantTitle: v.title,
				price: v.price,
				sku: v.sku,
				image: product.featuredImage?.url ?? null,
				quantity: 1,
				inventoryQuantity: v.inventoryQuantity,
				discountType: null,
				discountValue: 0,
				discountReason: ''
			});
		}
		checkedVariants = next;
	}

	function productCheckState(product: ProductResult): 'all' | 'some' | 'none' {
		const checkedCount = product.variants.nodes.filter((v) => checkedVariants.has(v.id)).length;
		if (checkedCount === 0) return 'none';
		if (checkedCount === product.variants.nodes.length) return 'all';
		return 'some';
	}

	function toggleProduct(product: ProductResult) {
		const next = new Map(checkedVariants);
		const shouldCheck = productCheckState(product) !== 'all';
		for (const v of product.variants.nodes) {
			if (shouldCheck) {
				next.set(v.id, {
					variantId: v.id,
					productTitle: product.title,
					variantTitle: v.title,
					price: v.price,
					sku: v.sku,
					image: product.featuredImage?.url ?? null,
					quantity: 1,
					inventoryQuantity: v.inventoryQuantity,
					discountType: null,
					discountValue: 0,
					discountReason: ''
				});
			} else {
				next.delete(v.id);
			}
		}
		checkedVariants = next;
	}

	function addSelectedVariants() {
		for (const item of checkedVariants.values()) {
			if (lineItems.some((i) => i.variantId === item.variantId)) continue;
			lineItems = [...lineItems, item];
		}
		showProductModal = false;
	}

	function removeLineItem(variantId: string) {
		lineItems = lineItems.filter((i) => i.variantId !== variantId);
	}

	// Per-item discount modal
	let showDiscountModal = $state(false);
	let discountItemId = $state('');
	let discountType = $state<'PERCENTAGE' | 'FIXED_AMOUNT'>('FIXED_AMOUNT');
	let discountValueInput = $state('');
	let discountReasonInput = $state('');
	const discountTypeLabels: Record<'FIXED_AMOUNT' | 'PERCENTAGE', string> = { FIXED_AMOUNT: 'Amount', PERCENTAGE: 'Percentage' };

	function openDiscountModal(item: LineItem) {
		discountItemId = item.variantId;
		discountType = item.discountType ?? 'FIXED_AMOUNT';
		discountValueInput = item.discountValue ? String(item.discountValue) : '';
		discountReasonInput = item.discountReason;
		showDiscountModal = true;
	}

	function saveDiscount() {
		const value = parseFloat(discountValueInput) || 0;
		lineItems = lineItems.map((i) =>
			i.variantId === discountItemId
				? { ...i, discountType: value > 0 ? discountType : null, discountValue: value, discountReason: discountReasonInput }
				: i
		);
		showDiscountModal = false;
	}

	// Order-level discount modal
	let showOrderDiscountModal = $state(false);
	let orderDiscountCode = $state('');
	let applyAutomaticDiscounts = $state(false);
	let addCustomOrderDiscount = $state(true);
	let orderDiscountType = $state<'FIXED_AMOUNT' | 'PERCENTAGE'>('FIXED_AMOUNT');
	let orderDiscountValueInput = $state('');
	let orderDiscountReason = $state('');

	let appliedOrderDiscountType = $state<'FIXED_AMOUNT' | 'PERCENTAGE' | null>(null);
	let appliedOrderDiscountValue = $state(0);
	let appliedOrderDiscountReason = $state('');

	function openOrderDiscountModal() {
		orderDiscountCode = '';
		applyAutomaticDiscounts = false;
		addCustomOrderDiscount = true;
		orderDiscountType = appliedOrderDiscountType ?? 'FIXED_AMOUNT';
		orderDiscountValueInput = appliedOrderDiscountValue ? String(appliedOrderDiscountValue) : '';
		orderDiscountReason = appliedOrderDiscountReason;
		showOrderDiscountModal = true;
	}

	function saveOrderDiscount() {
		if (addCustomOrderDiscount) {
			const value = parseFloat(orderDiscountValueInput) || 0;
			appliedOrderDiscountType = value > 0 ? orderDiscountType : null;
			appliedOrderDiscountValue = value;
			appliedOrderDiscountReason = orderDiscountReason;
		} else {
			appliedOrderDiscountType = null;
			appliedOrderDiscountValue = 0;
			appliedOrderDiscountReason = '';
		}
		showOrderDiscountModal = false;
	}

	// Shipping and delivery modal
	const SHIPPING_RATES = [{ title: 'Standard Delivery', price: 199 }];
	let showShippingModal = $state(false);
	let shippingMode = $state<'rate' | 'custom'>('rate');
	let selectedShippingRateIdx = $state('0');
	let customShippingTitle = $state('');
	let customShippingPrice = $state('');

	let appliedShippingTitle = $state('');
	let appliedShippingPrice = $state(0);

	function openShippingModal() {
		shippingMode = 'rate';
		selectedShippingRateIdx = '0';
		customShippingTitle = appliedShippingTitle;
		customShippingPrice = appliedShippingPrice ? String(appliedShippingPrice) : '';
		showShippingModal = true;
	}

	function saveShipping() {
		if (shippingMode === 'rate') {
			const rate = SHIPPING_RATES[parseInt(selectedShippingRateIdx, 10)];
			appliedShippingTitle = rate.title;
			appliedShippingPrice = rate.price;
		} else {
			appliedShippingTitle = customShippingTitle.trim() || 'Shipping';
			appliedShippingPrice = parseFloat(customShippingPrice) || 0;
		}
		showShippingModal = false;
	}

	function removeShipping() {
		appliedShippingTitle = '';
		appliedShippingPrice = 0;
	}

	let paymentDueLater = $state(false);
	let paymentTerms = $state('Due on receipt');
	const PAYMENT_TERMS_OPTIONS = ['Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 60', 'Net 90'];

	const subtotal = $derived(lineItems.reduce((sum, i) => sum + lineItemUnitPrice(i) * i.quantity, 0));
	const orderDiscountAmount = $derived.by(() => {
		if (!appliedOrderDiscountType || !appliedOrderDiscountValue) return 0;
		if (appliedOrderDiscountType === 'PERCENTAGE') return subtotal * (appliedOrderDiscountValue / 100);
		return Math.min(appliedOrderDiscountValue, subtotal);
	});
	const orderTotal = $derived(Math.max(0, subtotal - orderDiscountAmount) + appliedShippingPrice);

	// Custom item modal
	let showCustomItemModal = $state(false);
	let customItemName = $state('');
	let customItemPrice = $state('');
	let customItemQuantity = $state(1);

	function openCustomItemModal() {
		customItemName = '';
		customItemPrice = '';
		customItemQuantity = 1;
		showCustomItemModal = true;
	}

	function addCustomItem() {
		if (!customItemName.trim()) return;
		lineItems = [...lineItems, {
			variantId: `custom-${Date.now()}`,
			productTitle: customItemName.trim(),
			variantTitle: '',
			price: (parseFloat(customItemPrice) || 0).toFixed(2),
			sku: null,
			image: null,
			quantity: customItemQuantity || 1,
			inventoryQuantity: null,
			discountType: null,
			discountValue: 0,
			discountReason: ''
		}];
		showCustomItemModal = false;
	}

	interface CustomerResult {
		id: string;
		displayName: string;
		firstName?: string | null;
		lastName?: string | null;
		email: string | null;
		phone: string | null;
		numberOfOrders: number;
		defaultAddress?: {
			address1: string | null;
			address2: string | null;
			city: string | null;
			province: string | null;
			country: string | null;
			zip: string | null;
			phone: string | null;
		} | null;
	}

	let customerSearch = $state('');
	let customerResults = $state<CustomerResult[]>([]);
	let customerDropdownOpen = $state(false);
	let customerSearchLoading = $state(false);
	let selectedCustomer = $state<CustomerResult | null>(null);
	let customerSearchTimeout: ReturnType<typeof setTimeout>;
	let customerSearchToken = 0;

	async function loadCustomers() {
		const token = ++customerSearchToken;
		customerSearchLoading = true;
		try {
			const res = await fetch(`/api/shopify/${storeId}/customers?q=${encodeURIComponent(customerSearch)}`);
			if (token !== customerSearchToken) return; // a newer search superseded this one
			if (res.ok) customerResults = await res.json();
		} finally {
			if (token === customerSearchToken) customerSearchLoading = false;
		}
	}

	function onCustomerFocus() {
		customerDropdownOpen = true;
		loadCustomers();
	}

	function onCustomerInput() {
		clearTimeout(customerSearchTimeout);
		customerSearchTimeout = setTimeout(loadCustomers, 300);
	}

	function selectCustomer(c: CustomerResult) {
		selectedCustomer = c;
		customerSearch = '';
		customerDropdownOpen = false;
	}

	function clearCustomer() {
		selectedCustomer = null;
	}

	// New-customer modal
	let showNewCustomerModal = $state(false);
	let newCustFirstName = $state('');
	let newCustLastName = $state('');
	let newCustEmail = $state('');
	let newCustPhone = $state('');
	let newCustAddress1 = $state('');
	let newCustCity = $state('');
	let newCustProvince = $state('');
	let newCustCountry = $state('PK');
	let newCustZip = $state('');
	let creatingCustomer = $state(false);
	let newCustomerError = $state('');

	function openNewCustomerModal() {
		customerDropdownOpen = false;
		newCustFirstName = '';
		newCustLastName = '';
		newCustEmail = '';
		newCustPhone = '';
		newCustAddress1 = '';
		newCustCity = '';
		newCustProvince = '';
		newCustCountry = 'PK';
		newCustZip = '';
		newCustomerError = '';
		showNewCustomerModal = true;
	}

	async function submitNewCustomer() {
		if (!newCustFirstName.trim()) {
			newCustomerError = 'First name is required';
			return;
		}
		creatingCustomer = true;
		newCustomerError = '';
		try {
			const res = await fetch(`/api/shopify/${storeId}/customers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstName: newCustFirstName,
					lastName: newCustLastName,
					email: newCustEmail,
					phone: newCustPhone,
					address1: newCustAddress1,
					city: newCustCity,
					province: newCustProvince,
					country: newCustCountry,
					zip: newCustZip
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				newCustomerError = body?.message ?? 'Failed to create customer';
				return;
			}
			const customer = await res.json();
			selectedCustomer = customer;
			showNewCustomerModal = false;
		} catch {
			newCustomerError = 'Failed to create customer';
		} finally {
			creatingCustomer = false;
		}
	}

	// Customer card "..." menu + edit modal
	let showEditCustomerModal = $state(false);
	let editCustFirstName = $state('');
	let editCustLastName = $state('');
	let editCustEmail = $state('');
	let editCustPhone = $state('');
	let editCustAddress1 = $state('');
	let editCustCity = $state('');
	let editCustProvince = $state('');
	let editCustCountry = $state('PK');
	let editCustZip = $state('');
	let savingCustomer = $state(false);
	let editCustomerError = $state('');

	function openEditCustomerModal() {
		if (!selectedCustomer) return;
		const [first, ...rest] = selectedCustomer.displayName.split(' ');
		editCustFirstName = selectedCustomer.firstName ?? first ?? '';
		editCustLastName = selectedCustomer.lastName ?? rest.join(' ');
		editCustEmail = selectedCustomer.email ?? '';
		editCustPhone = selectedCustomer.phone ?? '';
		const addr = selectedCustomer.defaultAddress;
		editCustAddress1 = addr?.address1 ?? '';
		editCustCity = addr?.city ?? '';
		editCustProvince = addr?.province ?? '';
		editCustCountry = addr?.country ?? 'PK';
		editCustZip = addr?.zip ?? '';
		editCustomerError = '';
		showEditCustomerModal = true;
	}

	async function submitEditCustomer() {
		if (!selectedCustomer) return;
		if (!editCustFirstName.trim()) {
			editCustomerError = 'First name is required';
			return;
		}
		savingCustomer = true;
		editCustomerError = '';
		try {
			const res = await fetch(`/api/shopify/${storeId}/customers`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: selectedCustomer.id,
					firstName: editCustFirstName,
					lastName: editCustLastName,
					email: editCustEmail,
					phone: editCustPhone,
					address1: editCustAddress1,
					city: editCustCity,
					province: editCustProvince,
					country: editCustCountry,
					zip: editCustZip
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				editCustomerError = body?.message ?? 'Failed to save customer';
				return;
			}
			const updated = await res.json();
			// Server doesn't track order history — keep the count we already had.
			selectedCustomer = { ...updated, numberOfOrders: selectedCustomer.numberOfOrders };
			showEditCustomerModal = false;
		} catch {
			editCustomerError = 'Failed to save customer';
		} finally {
			savingCustomer = false;
		}
	}

	// Order submission
	let submittingOrder = $state(false);
	let orderSubmitError = $state('');

	function buildShippingAddress() {
		const addr = selectedCustomer?.defaultAddress;
		if (!addr?.address1 || !selectedCustomer) return undefined;
		const [firstName, ...rest] = selectedCustomer.displayName.split(' ');
		return {
			firstName: selectedCustomer.firstName ?? firstName ?? '',
			lastName: selectedCustomer.lastName ?? rest.join(' '),
			address1: addr.address1,
			address2: addr.address2 ?? undefined,
			city: addr.city ?? '',
			province: addr.province ?? '',
			country: addr.country ?? '',
			zip: addr.zip ?? '',
			phone: addr.phone ?? selectedCustomer.phone ?? undefined
		};
	}

	async function submitOrder(complete: boolean, paymentPending: boolean) {
		if (lineItems.length === 0) {
			orderSubmitError = 'Add at least one product before creating the order.';
			return;
		}
		submittingOrder = true;
		orderSubmitError = '';
		try {
			const res = await fetch(`/api/shopify/${storeId}/draft-orders`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lineItems: lineItems.map((i) => ({
						variantId: i.variantId.startsWith('custom-') ? undefined : i.variantId,
						title: i.variantId.startsWith('custom-') ? i.productTitle : undefined,
						originalUnitPrice: i.variantId.startsWith('custom-') ? i.price : undefined,
						quantity: i.quantity,
						appliedDiscount: i.discountType && i.discountValue
							? { value: i.discountValue, valueType: i.discountType, title: i.discountReason || undefined }
							: undefined
					})),
					customerId: selectedCustomer?.id,
					shippingAddress: buildShippingAddress(),
					shippingLine: appliedShippingTitle
						? { title: appliedShippingTitle, price: appliedShippingPrice.toFixed(2) }
						: undefined,
					appliedDiscount: appliedOrderDiscountType && appliedOrderDiscountValue
						? { value: appliedOrderDiscountValue, valueType: appliedOrderDiscountType, title: appliedOrderDiscountReason || 'Discount' }
						: undefined,
					complete,
					paymentPending
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				orderSubmitError = body?.message ?? 'Failed to create order';
				return;
			}
			const body = await res.json();
			if (body.orderId) {
				goto(`/dispatcher/stores/${storeId}/orders/${shopifyIdToNumber(body.orderId)}`);
			} else {
				goto(`/dispatcher/stores/${storeId}/draft-orders/${shopifyIdToNumber(body.draftOrderId)}`);
			}
		} catch {
			orderSubmitError = 'Failed to create order';
		} finally {
			submittingOrder = false;
		}
	}
</script>

<svelte:head>
	<title>Create Order — Pro Shipper</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<div class="mb-6">
		<a href="/dispatcher/stores/{storeId}/orders" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
			<ArrowLeftIcon class="size-4" />
			Back to Orders
		</a>
		<h1 class="text-2xl font-bold">Create Order</h1>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left column -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Products -->
			<Card.Root>
				<Card.Header class="border-b [.border-b]:pb-6">
					<Card.Title>Products</Card.Title>
					<Card.Action>
						<div class="flex items-center gap-2">
							<Button variant="outline" size="sm" onclick={openProductModal}>
								<PlusIcon class="size-4" />
								Add product
							</Button>
							<Button variant="outline" size="sm" onclick={openCustomItemModal}>
								<PlusIcon class="size-4" />
								Add custom item
							</Button>
						</div>
					</Card.Action>
				</Card.Header>
				{#if lineItems.length > 0}
					<div class="divide-y divide-border">
						{#each lineItems as item (item.variantId)}
							{@const unitPrice = lineItemUnitPrice(item)}
							{@const hasDiscount = !!item.discountType && item.discountValue > 0}
							<div class="px-6 py-3 flex items-center gap-3">
								{#if item.image}
									<img src={item.image} alt={item.productTitle} class="size-10 rounded-md object-cover border border-border shrink-0" />
								{:else}
									<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
								{/if}
								<div class="flex-1 min-w-0 text-sm">
									<div class="font-medium text-foreground">{item.productTitle}</div>
									{#if item.variantTitle && item.variantTitle !== 'Default Title'}
										<span class="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">{item.variantTitle}</span>
									{/if}
								</div>
								<button type="button" class="text-sm text-right w-24 shrink-0 hover:underline cursor-pointer" onclick={() => openDiscountModal(item)}>
									<div class="text-primary font-medium">Rs {unitPrice.toFixed(2)}</div>
									{#if hasDiscount}
										<div class="text-xs text-muted-foreground line-through">Rs {parseFloat(item.price).toFixed(2)}</div>
									{/if}
								</button>
								<Input type="number" min="1" bind:value={item.quantity} class="w-16 text-center h-8" />
								<span class="text-sm font-medium w-24 text-right">Rs {(unitPrice * item.quantity).toFixed(2)}</span>
								<Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" onclick={() => removeLineItem(item.variantId)}>
									<XIcon class="size-4" />
								</Button>
							</div>
							{#if item.inventoryQuantity === 0}
								<div class="px-6 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800 flex items-center gap-2">
									<TriangleAlertIcon class="size-4 shrink-0" />
									This product has 0 units in stock.
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</Card.Root>

			<!-- Payment -->
			<Card.Root class="overflow-hidden">
				<Card.Header class="border-b [.border-b]:pb-6">
					<Card.Title>Payment</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Subtotal</span>
						<span class="font-medium">Rs {subtotal.toFixed(2)}</span>
					</div>
					<div class="flex items-center justify-between">
						<button type="button" class="text-primary hover:underline cursor-pointer" onclick={openOrderDiscountModal}>
							{appliedOrderDiscountType ? 'Discount' : 'Add discount'}
						</button>
						<span class="font-medium">{orderDiscountAmount > 0 ? `−Rs ${orderDiscountAmount.toFixed(2)}` : 'Rs 0.00'}</span>
					</div>
					<div class="flex items-center justify-between">
						{#if appliedShippingTitle}
							<button type="button" class="text-primary hover:underline text-left cursor-pointer" onclick={openShippingModal}>{appliedShippingTitle}</button>
						{:else}
							<button type="button" class="text-primary hover:underline cursor-pointer" onclick={openShippingModal}>Add shipping or delivery</button>
						{/if}
						<span class="font-medium">Rs {appliedShippingPrice.toFixed(2)}</span>
					</div>
					<div class="flex items-center justify-between font-bold text-base border-t border-border pt-2">
						<span>Total</span>
						<span>Rs {orderTotal.toFixed(2)}</span>
					</div>
				</Card.Content>
				{#if lineItems.length === 0}
					<div class="px-6 py-3 bg-muted/30 border-t border-border text-xs text-muted-foreground">
						Add a product to calculate total and view payment options
					</div>
				{:else}
					<Card.Content class="pt-4 border-t border-border space-y-3">
						<label class="flex items-center gap-2 text-sm cursor-pointer">
							<Checkbox bind:checked={paymentDueLater} />
							Payment due later
						</label>
						{#if paymentDueLater}
							<div class="space-y-1.5">
								<Label for="paymentTerms">Payment terms</Label>
								<Select.Root type="single" bind:value={paymentTerms}>
									<Select.Trigger id="paymentTerms" class="w-full">{paymentTerms}</Select.Trigger>
									<Select.Content>
										{#each PAYMENT_TERMS_OPTIONS as term}
											<Select.Item value={term} label={term}>{term}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<p class="text-sm text-muted-foreground">
								<span class="font-semibold text-foreground">Payment due when invoice is sent.</span> You'll be able to collect the balance from the order page.
							</p>
						{/if}
					</Card.Content>
					{#if orderSubmitError}
						<div class="px-6 pb-3">
							<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{orderSubmitError}</div>
						</div>
					{/if}
					<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
						{#if paymentDueLater}
							<Button variant="outline" disabled={submittingOrder} onclick={() => submitOrder(false, false)}>Send invoice</Button>
						{:else}
							<Button variant="outline" disabled={submittingOrder} onclick={() => submitOrder(true, false)}>Mark as paid</Button>
						{/if}
						<Button disabled={submittingOrder} onclick={() => submitOrder(true, true)}>
							{submittingOrder ? 'Creating…' : 'Create order'}
						</Button>
					</div>
				{/if}
			</Card.Root>
		</div>

		<!-- Right column -->
		<div class="space-y-6">
			<!-- Customer -->
			<Card.Root>
				<Card.Header class="border-b [.border-b]:pb-6">
					<Card.Title>Customer</Card.Title>
					{#if selectedCustomer}
						<Card.Action>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="ghost" size="icon" class="size-7 text-muted-foreground">
											<MoreHorizontalIcon class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="w-36">
									<DropdownMenu.Item onclick={openEditCustomerModal}>Edit</DropdownMenu.Item>
									<DropdownMenu.Item variant="destructive" onclick={clearCustomer}>Remove</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</Card.Action>
					{/if}
				</Card.Header>
				<Card.Content>
					{#if selectedCustomer}
						{@const addr = selectedCustomer.defaultAddress}
						<div class="space-y-4 text-sm">
							<div>
								<a href="/dispatcher/stores/{storeId}/customers/{selectedCustomer.id.split('/').pop()}" target="_blank" class="text-primary hover:underline font-medium">{selectedCustomer.displayName}</a>
								{#if selectedCustomer.numberOfOrders > 0}
									<div class="mt-0.5">
										<a href="/dispatcher/stores/{storeId}/customers/{selectedCustomer.id.split('/').pop()}" target="_blank" class="text-primary hover:underline text-xs">
											{selectedCustomer.numberOfOrders} order{selectedCustomer.numberOfOrders === 1 ? '' : 's'}
										</a>
									</div>
								{/if}
							</div>

							{#if selectedCustomer.email || selectedCustomer.phone}
								<div>
									<div class="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Contact information</div>
									{#if selectedCustomer.email}<div><a href="mailto:{selectedCustomer.email}" class="text-primary hover:underline">{selectedCustomer.email}</a></div>{/if}
									{#if selectedCustomer.phone}<div class="text-muted-foreground">{selectedCustomer.phone}</div>{/if}
								</div>
							{/if}

							{#if addr?.address1}
								<div>
									<div class="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Shipping address</div>
									<div class="text-foreground">
										<div>{selectedCustomer.displayName}</div>
										<div>{addr.address1}</div>
										{#if addr.address2}<div>{addr.address2}</div>{/if}
										<div>{addr.city} {addr.zip}</div>
										{#if addr.country}<div>{addr.country}</div>{/if}
										{#if addr.phone}<div>{addr.phone}</div>{/if}
									</div>
								</div>

								<div>
									<div class="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Billing address</div>
									<p class="text-muted-foreground">Same as shipping address</p>
								</div>
							{/if}
						</div>
					{:else}
						<div class="relative" use:clickOutside={() => customerDropdownOpen = false}>
							<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								type="text"
								class="pl-9 {customerSearchLoading ? 'pr-9' : ''}"
								placeholder="Search or create a customer"
								bind:value={customerSearch}
								onfocus={onCustomerFocus}
								oninput={onCustomerInput}
							/>
							{#if customerSearchLoading}
								<Loader2Icon class="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
							{/if}
							{#if customerDropdownOpen}
								<div class="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
									<button
										type="button"
										class="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-muted transition-colors border-b border-border cursor-pointer"
										onclick={openNewCustomerModal}
									>
										<PlusIcon class="size-4" />
										Create a new customer
									</button>
									{#if customerSearchLoading && customerResults.length === 0}
										<div class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
											<Loader2Icon class="size-4 animate-spin" />
											Loading customers…
										</div>
									{:else if customerResults.length === 0}
										<p class="text-sm text-muted-foreground text-center py-4">No customers found</p>
									{:else}
										{#each customerResults as c}
											<button
												type="button"
												class="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0 cursor-pointer"
												onclick={() => selectCustomer(c)}
											>
												<div class="text-sm font-medium text-foreground">{c.displayName}</div>
												{#if c.email}<div class="text-xs text-muted-foreground">{c.email}</div>{/if}
											</button>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Notes -->
			<Card.Root>
				<Card.Header class="border-b [.border-b]:pb-6">
					<Card.Title>Notes</Card.Title>
					<Card.Action>
						<Button variant="ghost" size="icon" class="size-7 text-muted-foreground" title="Edit notes">
							<PencilIcon class="size-4" />
						</Button>
					</Card.Action>
				</Card.Header>
				<Card.Content>
					<p class="text-sm text-muted-foreground">No notes</p>
				</Card.Content>
			</Card.Root>

			<!-- Tags -->
			<Card.Root>
				<Card.Header class="border-b [.border-b]:pb-6">
					<Card.Title>Tags</Card.Title>
					<Card.Action>
						<Button variant="ghost" size="icon" class="size-7 text-muted-foreground" title="Edit tags">
							<PencilIcon class="size-4" />
						</Button>
					</Card.Action>
				</Card.Header>
				<Card.Content>
					<Input type="text" />
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<!-- New customer modal -->
<Dialog.Root bind:open={showNewCustomerModal}>
	<Dialog.Content class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Create a new customer</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			{#if newCustomerError}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{newCustomerError}</div>
			{/if}
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="newCustFirstName">First Name <span class="text-destructive">*</span></Label>
					<Input id="newCustFirstName" bind:value={newCustFirstName} required />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustLastName">Last Name</Label>
					<Input id="newCustLastName" bind:value={newCustLastName} />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustPhone">Phone</Label>
					<Input id="newCustPhone" type="tel" placeholder="03XXXXXXXXX" bind:value={newCustPhone} />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustEmail">Email</Label>
					<Input id="newCustEmail" type="email" bind:value={newCustEmail} />
				</div>
			</div>
			<div class="space-y-1.5 pt-2 border-t border-border">
				<Label class="text-xs text-muted-foreground">Address (optional)</Label>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="col-span-2 space-y-1.5">
					<Label for="newCustAddress1">Address</Label>
					<Input id="newCustAddress1" bind:value={newCustAddress1} />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustCity">City</Label>
					<Input id="newCustCity" bind:value={newCustCity} />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustProvince">Province</Label>
					<Input id="newCustProvince" bind:value={newCustProvince} />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustCountry">Country</Label>
					<Input id="newCustCountry" bind:value={newCustCountry} />
				</div>
				<div class="space-y-1.5">
					<Label for="newCustZip">ZIP</Label>
					<Input id="newCustZip" bind:value={newCustZip} />
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" disabled={creatingCustomer} onclick={() => showNewCustomerModal = false}>Cancel</Button>
			<Button disabled={creatingCustomer} onclick={submitNewCustomer}>
				{creatingCustomer ? 'Creating…' : 'Create Customer'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit customer modal -->
<Dialog.Root bind:open={showEditCustomerModal}>
	<Dialog.Content class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit customer</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			{#if editCustomerError}
				<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{editCustomerError}</div>
			{/if}
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="editCustFirstName">First Name <span class="text-destructive">*</span></Label>
					<Input id="editCustFirstName" bind:value={editCustFirstName} required />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustLastName">Last Name</Label>
					<Input id="editCustLastName" bind:value={editCustLastName} />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustPhone">Phone</Label>
					<Input id="editCustPhone" type="tel" placeholder="03XXXXXXXXX" bind:value={editCustPhone} />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustEmail">Email</Label>
					<Input id="editCustEmail" type="email" bind:value={editCustEmail} />
				</div>
			</div>
			<div class="space-y-1.5 pt-2 border-t border-border">
				<Label class="text-xs text-muted-foreground">Address</Label>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="col-span-2 space-y-1.5">
					<Label for="editCustAddress1">Address</Label>
					<Input id="editCustAddress1" bind:value={editCustAddress1} />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustCity">City</Label>
					<Input id="editCustCity" bind:value={editCustCity} />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustProvince">Province</Label>
					<Input id="editCustProvince" bind:value={editCustProvince} />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustCountry">Country</Label>
					<Input id="editCustCountry" bind:value={editCustCountry} />
				</div>
				<div class="space-y-1.5">
					<Label for="editCustZip">ZIP</Label>
					<Input id="editCustZip" bind:value={editCustZip} />
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" disabled={savingCustomer} onclick={() => showEditCustomerModal = false}>Cancel</Button>
			<Button disabled={savingCustomer} onclick={submitEditCustomer}>
				{savingCustomer ? 'Saving…' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Select products modal -->
<Dialog.Root bind:open={showProductModal}>
	<Dialog.Content class="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
		<Dialog.Header class="p-6 pb-3">
			<Dialog.Title>Select products</Dialog.Title>
		</Dialog.Header>
		<div class="px-6 pb-3">
			<div class="relative">
				<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<Input
					type="text"
					class="pl-9"
					placeholder="Search products"
					bind:value={productModalSearch}
					oninput={onProductModalInput}
				/>
				{#if productModalLoading && productModalResults.length > 0}
					<Loader2Icon class="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
				{/if}
			</div>
		</div>
		<div class="flex-1 overflow-y-auto border-t border-border">
			{#if productModalLoading && productModalResults.length === 0}
				<div class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
					<Loader2Icon class="size-4 animate-spin" />
					Loading products…
				</div>
			{:else if productModalResults.length === 0}
				<p class="text-sm text-muted-foreground text-center py-8">No products found</p>
			{:else}
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-card">
						<tr class="border-b border-border">
							<th class="text-left px-4 py-2 font-medium text-muted-foreground w-8"></th>
							<th class="text-left px-2 py-2 font-medium text-muted-foreground">Product</th>
							<th class="text-right px-2 py-2 font-medium text-muted-foreground">Available</th>
							<th class="text-right px-4 py-2 font-medium text-muted-foreground">Price</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each productModalResults as product}
							{#if product.variants.nodes.length === 1}
								{@const v = product.variants.nodes[0]}
								<tr class="hover:bg-muted/40">
									<td class="px-4 py-2">
										<Checkbox checked={checkedVariants.has(v.id)} onCheckedChange={() => toggleVariant(product, v)} />
									</td>
									<td class="px-2 py-2">
										<div class="flex items-center gap-3">
											{#if product.featuredImage?.url}
												<img src={product.featuredImage.url} alt={product.title} class="size-10 rounded-md object-cover border border-border shrink-0" />
											{:else}
												<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
											{/if}
											<span class="font-medium text-foreground">{product.title}</span>
										</div>
									</td>
									<td class="px-2 py-2 text-right text-muted-foreground">{v.inventoryQuantity ?? '—'}</td>
									<td class="px-4 py-2 text-right font-medium">Rs {v.price}</td>
								</tr>
							{:else}
								{@const checkState = productCheckState(product)}
								<tr class="bg-muted/20">
									<td class="px-4 py-2">
										<Checkbox
											checked={checkState === 'all'}
											indeterminate={checkState === 'some'}
											onCheckedChange={() => toggleProduct(product)}
										/>
									</td>
									<td colspan="3" class="px-2 py-2">
										<div class="flex items-center gap-3">
											{#if product.featuredImage?.url}
												<img src={product.featuredImage.url} alt={product.title} class="size-10 rounded-md object-cover border border-border shrink-0" />
											{:else}
												<div class="size-10 rounded-md bg-muted border border-border shrink-0"></div>
											{/if}
											<span class="font-medium text-foreground">{product.title}</span>
										</div>
									</td>
								</tr>
								{#each product.variants.nodes as v}
									<tr class="hover:bg-muted/40">
										<td class="px-4 py-2">
											<Checkbox checked={checkedVariants.has(v.id)} onCheckedChange={() => toggleVariant(product, v)} />
										</td>
										<td class="px-2 py-2 pl-6 text-foreground">{v.title}</td>
										<td class="px-2 py-2 text-right text-muted-foreground">{v.inventoryQuantity ?? '—'}</td>
										<td class="px-4 py-2 text-right font-medium">Rs {v.price}</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
		<div class="flex items-center justify-between px-6 py-4 border-t border-border">
			<span class="text-sm text-muted-foreground">{checkedVariants.size}/500 variants selected</span>
			<div class="flex gap-3">
				<Button variant="outline" onclick={() => showProductModal = false}>Cancel</Button>
				<Button disabled={checkedVariants.size === 0} onclick={addSelectedVariants}>Add</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Custom item modal -->
<Dialog.Root bind:open={showCustomItemModal}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Add custom item</Dialog.Title>
		</Dialog.Header>
		<div class="grid grid-cols-3 gap-4">
			<div class="space-y-1.5">
				<Label for="customItemName">Item name</Label>
				<Input id="customItemName" bind:value={customItemName} />
			</div>
			<div class="space-y-1.5">
				<Label for="customItemPrice">Price</Label>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
					<Input id="customItemPrice" type="number" min="0" step="0.01" class="pl-8" bind:value={customItemPrice} placeholder="0.00" />
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="customItemQuantity">Quantity</Label>
				<Input id="customItemQuantity" type="number" min="1" bind:value={customItemQuantity} />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => showCustomItemModal = false}>Cancel</Button>
			<Button disabled={!customItemName.trim()} onclick={addCustomItem}>Add item</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Per-item discount modal -->
<Dialog.Root bind:open={showDiscountModal}>
	{@const discountItem = lineItems.find((i) => i.variantId === discountItemId)}
	<Dialog.Content class="sm:max-w-sm p-0 gap-0 overflow-hidden">
		<div class="bg-muted/40 px-5 py-4 flex items-center justify-between">
			<div>
				<div class="font-semibold text-sm">Unit price</div>
				<div class="text-sm text-foreground mt-0.5">Rs {discountItem ? parseFloat(discountItem.price).toFixed(2) : '0.00'}</div>
			</div>
			<PencilIcon class="size-4 text-muted-foreground" />
		</div>
		<div class="p-5 space-y-4">
			<h3 class="font-semibold text-sm">Custom discount</h3>
			<div class="space-y-1.5">
				<Label for="discountTypeSelect">Discount type</Label>
				<Select.Root type="single" bind:value={discountType}>
					<Select.Trigger id="discountTypeSelect" class="w-full">{discountTypeLabels[discountType]}</Select.Trigger>
					<Select.Content>
						<Select.Item value="FIXED_AMOUNT" label="Amount">Amount</Select.Item>
						<Select.Item value="PERCENTAGE" label="Percentage">Percentage</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1.5">
				<Label for="discountValueInput">Discount value (per unit)</Label>
				<div class="relative">
					{#if discountType === 'FIXED_AMOUNT'}
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
						<Input id="discountValueInput" type="number" min="0" step="0.01" class="pl-8 pr-14" bind:value={discountValueInput} placeholder="0.00" />
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">PKR</span>
					{:else}
						<Input id="discountValueInput" type="number" min="0" max="100" step="0.01" class="pr-8" bind:value={discountValueInput} placeholder="0" />
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
					{/if}
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="discountReasonInput">Reason for discount</Label>
				<Input id="discountReasonInput" bind:value={discountReasonInput} />
				<p class="text-xs text-primary">Visible to customer</p>
			</div>
		</div>
		<div class="px-5 py-4 border-t border-border">
			<Button class="w-full" onclick={saveDiscount}>Done</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Order-level discount modal -->
<Dialog.Root bind:open={showOrderDiscountModal}>
	<Dialog.Content class="sm:max-w-md p-0 gap-0 overflow-hidden">
		<div class="bg-muted/40 px-5 py-4">
			<h2 class="font-semibold">Add discount</h2>
		</div>
		<div class="p-5 space-y-4">
			<div class="space-y-1.5">
				<Label for="orderDiscountCode">Discount codes</Label>
				<Input id="orderDiscountCode" placeholder="Enter a discount code" bind:value={orderDiscountCode} />
			</div>
			<label class="flex items-center gap-2 text-sm cursor-pointer">
				<Checkbox bind:checked={applyAutomaticDiscounts} />
				Apply all eligible automatic discounts
			</label>
			<label class="flex items-center gap-2 text-sm cursor-pointer">
				<Checkbox bind:checked={addCustomOrderDiscount} />
				Add custom order discount
			</label>
			{#if addCustomOrderDiscount}
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<Label for="orderDiscountType">Discount type</Label>
						<Select.Root type="single" bind:value={orderDiscountType}>
							<Select.Trigger id="orderDiscountType" class="w-full">{discountTypeLabels[orderDiscountType]}</Select.Trigger>
							<Select.Content>
								<Select.Item value="FIXED_AMOUNT" label="Amount">Amount</Select.Item>
								<Select.Item value="PERCENTAGE" label="Percentage">Percentage</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-1.5">
						<Label for="orderDiscountValueInput">Discount value</Label>
						<div class="relative">
							{#if orderDiscountType === 'FIXED_AMOUNT'}
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
								<Input id="orderDiscountValueInput" type="number" min="0" step="0.01" class="pl-8 pr-14" bind:value={orderDiscountValueInput} placeholder="0.00" />
								<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">PKR</span>
							{:else}
								<Input id="orderDiscountValueInput" type="number" min="0" max="100" step="0.01" class="pr-8" bind:value={orderDiscountValueInput} placeholder="0" />
								<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
							{/if}
						</div>
					</div>
				</div>
				<div class="space-y-1.5">
					<Label for="orderDiscountReason">Reason for discount</Label>
					<Input id="orderDiscountReason" bind:value={orderDiscountReason} />
					<p class="text-xs text-primary">Visible to customer</p>
				</div>
			{/if}
		</div>
		<div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
			<Button variant="outline" onclick={() => showOrderDiscountModal = false}>Cancel</Button>
			<Button onclick={saveOrderDiscount}>Done</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Shipping and delivery modal -->
<Dialog.Root bind:open={showShippingModal}>
	<Dialog.Content class="sm:max-w-md p-0 gap-0 overflow-hidden">
		<div class="bg-muted/40 px-5 py-4">
			<h2 class="font-semibold">Shipping and delivery options</h2>
		</div>
		<div class="p-5 space-y-4">
			<label class="flex items-start gap-3 cursor-pointer">
				<input type="radio" name="shippingMode" class="mt-1" checked={shippingMode === 'rate'} onchange={() => shippingMode = 'rate'} />
				<div class="flex-1">
					<div class="text-sm font-medium text-foreground">Shipping rates</div>
					<p class="text-xs text-muted-foreground mt-0.5">Select eligible shipping rates based on your Shipping settings</p>
					{#if shippingMode === 'rate'}
						<Select.Root type="single" bind:value={selectedShippingRateIdx}>
							<Select.Trigger class="w-full mt-2">
								{@const rate = SHIPPING_RATES[parseInt(selectedShippingRateIdx, 10)]}
								{rate.title} - Rs {rate.price.toFixed(2)}
							</Select.Trigger>
							<Select.Content>
								{#each SHIPPING_RATES as rate, i}
									<Select.Item value={String(i)} label="{rate.title} - Rs {rate.price.toFixed(2)}">{rate.title} - Rs {rate.price.toFixed(2)}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}
				</div>
			</label>
			<label class="flex items-center gap-3 cursor-pointer">
				<input type="radio" name="shippingMode" checked={shippingMode === 'custom'} onchange={() => shippingMode = 'custom'} />
				<div class="text-sm font-medium text-foreground">Custom shipping</div>
			</label>
			{#if shippingMode === 'custom'}
				<div class="grid grid-cols-2 gap-4 pl-7">
					<div class="space-y-1.5">
						<Label for="customShippingTitle">Name</Label>
						<Input id="customShippingTitle" placeholder="Shipping" bind:value={customShippingTitle} />
					</div>
					<div class="space-y-1.5">
						<Label for="customShippingPrice">Price</Label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
							<Input id="customShippingPrice" type="number" min="0" step="0.01" class="pl-8" bind:value={customShippingPrice} placeholder="0.00" />
						</div>
					</div>
				</div>
			{/if}
		</div>
		<div class="flex items-center justify-between px-5 py-4 border-t border-border">
			{#if appliedShippingTitle}
				<button type="button" class="text-sm text-destructive hover:underline cursor-pointer" onclick={() => { removeShipping(); showShippingModal = false; }}>Remove</button>
			{:else}
				<span></span>
			{/if}
			<div class="flex gap-3">
				<Button variant="outline" onclick={() => showShippingModal = false}>Cancel</Button>
				<Button onclick={saveShipping}>Done</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
