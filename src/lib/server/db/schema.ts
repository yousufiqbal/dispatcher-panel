import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const admin = sqliteTable('admin', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	totpSecret: text('totp_secret'),
	totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const dispatchers = sqliteTable('dispatchers', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name').notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const accountants = sqliteTable('accountants', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name').notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const stores = sqliteTable('stores', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	iconUrl: text('icon_url'),
	shopifyDomain: text('shopify_domain').notNull().unique(),
	apiAccessToken: text('api_access_token').notNull(),
	oauthClientId: text('oauth_client_id'),
	oauthClientSecret: text('oauth_client_secret'),
	oauthRedirectUri: text('oauth_redirect_uri'),
	// Restock tool: how many days air/sea shipments take to arrive, used to size
	// the recommended reorder quantity so stock doesn't run out before it lands.
	airLeadDays: integer('air_lead_days').notNull().default(15),
	seaLeadDays: integer('sea_lead_days').notNull().default(60),
	// Pricing tool: CNY->PKR rate, per-gram shipping cost, price/compare-at
	// multipliers applied to (cost + weight*shippingCostPerGram), and a COD
	// buffer % layered on top of both. See src/lib/pricing.ts for the formula.
	cnyToPkrRate: text('cny_to_pkr_rate').notNull().default('40'),
	shippingCostPerGram: text('shipping_cost_per_gram').notNull().default('0'),
	priceMultiplier: text('price_multiplier').notNull().default('2'),
	compareAtMultiplier: text('compare_at_multiplier').notNull().default('3'),
	codPercentage: text('cod_percentage').notNull().default('4'),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const dispatcherStoreAccess = sqliteTable(
	'dispatcher_store_access',
	{
		dispatcherId: text('dispatcher_id')
			.notNull()
			.references(() => dispatchers.id, { onDelete: 'cascade' }),
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		grantedAt: integer('granted_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.dispatcherId, table.storeId] })]
);

export const accountantStoreAccess = sqliteTable(
	'accountant_store_access',
	{
		accountantId: text('accountant_id')
			.notNull()
			.references(() => accountants.id, { onDelete: 'cascade' }),
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		grantedAt: integer('granted_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.accountantId, table.storeId] })]
);

export const dispatcherPushSubscriptions = sqliteTable('dispatcher_push_subscriptions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	dispatcherId: text('dispatcher_id')
		.notNull()
		.references(() => dispatchers.id, { onDelete: 'cascade' }),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	role: text('role', { enum: ['admin', 'dispatcher', 'accounting'] }).notNull(),
	totpVerified: integer('totp_verified', { mode: 'boolean' }).notNull().default(false),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent')
});

export const couriers = sqliteTable('couriers', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	provider: text('provider', { enum: ['postex', 'dex'] }).notNull(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	apiKey: text('api_key'),
	defaultWeight: text('default_weight'),
	defaultFragile: integer('default_fragile', { mode: 'boolean' }).notNull().default(false),
	defaultNote: text('default_note'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const courierStoreAccess = sqliteTable(
	'courier_store_access',
	{
		courierId: text('courier_id')
			.notNull()
			.references(() => couriers.id, { onDelete: 'cascade' }),
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		grantedAt: integer('granted_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.courierId, table.storeId] })]
);

export const courierBookings = sqliteTable('courier_bookings', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	orderId: text('order_id').notNull(),
	orderName: text('order_name').notNull(),
	courierId: text('courier_id').references(() => couriers.id, { onDelete: 'set null' }),
	provider: text('provider', { enum: ['postex', 'dex'] }).notNull(),
	trackingId: text('tracking_id').notNull(),
	weight: text('weight'),
	codAmount: text('cod_amount'),
	fragile: integer('fragile', { mode: 'boolean' }).notNull().default(false),
	note: text('note'),
	status: text('status'),
	statusUpdatedAt: integer('status_updated_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const activityLogSettings = sqliteTable('activity_log_settings', {
	action: text('action').primaryKey(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull()
});

// --- Restock tool ---------------------------------------------------------
// A "session" is one pass through the catalog (start → page through products
// entering quantities → complete). Never writes to Shopify — output is a
// report the admin acts on manually, by design (keeps inventory writes out
// of dispatcher hands).

export const restockSessions = sqliteTable('restock_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	startedAt: integer('started_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	completedAt: integer('completed_at', { mode: 'timestamp' }),
	totalProducts: integer('total_products').notNull().default(0)
});

export const restockItems = sqliteTable('restock_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => restockSessions.id, { onDelete: 'cascade' }),
	productId: text('product_id').notNull(),
	variantId: text('variant_id').notNull(),
	productTitle: text('product_title').notNull(),
	variantTitle: text('variant_title'),
	sku: text('sku'),
	productImageUrl: text('product_image_url'),
	variantImageUrl: text('variant_image_url'),
	sales30: integer('sales_30').notNull().default(0),
	sales60: integer('sales_60').notNull().default(0),
	sales90: integer('sales_90').notNull().default(0),
	currentStock: integer('current_stock').notNull().default(0),
	recAir: integer('rec_air').notNull().default(0),
	recSea: integer('rec_sea').notNull().default(0),
	actualRestock: integer('actual_restock'),
	position: integer('position').notNull().default(0),
	variantPosition: integer('variant_position').notNull().default(0),
	orderedAt: integer('ordered_at', { mode: 'timestamp' })
});

export const inventorySessions = sqliteTable('inventory_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	startedAt: integer('started_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	completedAt: integer('completed_at', { mode: 'timestamp' }),
	totalProducts: integer('total_products').notNull().default(0)
});

export const inventoryItems = sqliteTable('inventory_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => inventorySessions.id, { onDelete: 'cascade' }),
	productId: text('product_id').notNull(),
	variantId: text('variant_id').notNull(),
	productTitle: text('product_title').notNull(),
	variantTitle: text('variant_title'),
	sku: text('sku'),
	productImageUrl: text('product_image_url'),
	variantImageUrl: text('variant_image_url'),
	currentStock: integer('current_stock').notNull().default(0),
	newStock: integer('new_stock'),
	skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false),
	position: integer('position').notNull().default(0),
	variantPosition: integer('variant_position').notNull().default(0),
	// Fields below exist only to reproduce Shopify's own "Export inventory" CSV
	// template on the report page, so the admin can fill gaps and re-upload it
	// straight into Shopify without reformatting.
	handle: text('handle'),
	option1Name: text('option1_name'),
	option1Value: text('option1_value'),
	option2Name: text('option2_name'),
	option2Value: text('option2_value'),
	option3Name: text('option3_name'),
	option3Value: text('option3_value'),
	hsCode: text('hs_code'),
	countryOfOrigin: text('country_of_origin'),
	locationName: text('location_name'),
	incoming: integer('incoming').notNull().default(0),
	unavailable: integer('unavailable').notNull().default(0),
	committed: integer('committed').notNull().default(0),
	available: integer('available').notNull().default(0)
});

// --- Accounting: operating expenses ---------------------------------------

export const recurringExpenses = sqliteTable('recurring_expenses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	category: text('category').notNull(),
	description: text('description'),
	amount: text('amount').notNull(),
	dayOfMonth: integer('day_of_month').notNull().default(1),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	// 'YYYY-MM' of the last month this was turned into an operatingExpenses row —
	// the materialize cron uses this to avoid double-posting the same month.
	lastMaterializedMonth: text('last_materialized_month'),
	createdBy: text('created_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const operatingExpenses = sqliteTable('operating_expenses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	category: text('category').notNull(),
	description: text('description'),
	amount: text('amount').notNull(),
	expenseDate: integer('expense_date', { mode: 'timestamp' }).notNull(),
	recurringExpenseId: text('recurring_expense_id').references(() => recurringExpenses.id, { onDelete: 'set null' }),
	createdBy: text('created_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// --- Accounting: purchases, damages, weighted-average cost ledger --------
//
// variantCosts is a CACHE of current qty+avg-cost per SKU — it is always
// re-derivable from scratch by folding inventoryCostEvents in order, so if it
// ever looks wrong the ledger is what you trust and rebuild from, not this
// table. inventoryCostEvents is append-only and never updated or deleted —
// it's the audit trail for reconciling our records against live Shopify stock.

export const variantCosts = sqliteTable(
	'variant_costs',
	{
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		variantId: text('variant_id').notNull(),
		sku: text('sku'),
		quantityOnHand: integer('quantity_on_hand').notNull().default(0),
		avgCost: text('avg_cost').notNull().default('0'),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.storeId, table.variantId] })]
);

export const inventoryCostEvents = sqliteTable('inventory_cost_events', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	variantId: text('variant_id').notNull(),
	sku: text('sku'),
	type: text('type', { enum: ['purchase', 'damage', 'sale'] }).notNull(),
	quantityDelta: integer('quantity_delta').notNull(),
	unitCost: text('unit_cost').notNull(),
	totalCost: text('total_cost').notNull(),
	qtyBefore: integer('qty_before').notNull(),
	avgCostBefore: text('avg_cost_before').notNull(),
	qtyAfter: integer('qty_after').notNull(),
	avgCostAfter: text('avg_cost_after').notNull(),
	sourceType: text('source_type', { enum: ['purchase', 'damage', 'order'] }).notNull(),
	sourceId: text('source_id').notNull(),
	// What we asked Shopify to change vs. what it actually confirmed changing —
	// a mismatch here (or a failed status) is exactly the kind of drift this
	// ledger exists to catch.
	shopifyAdjustmentStatus: text('shopify_adjustment_status', { enum: ['success', 'failed', 'skipped'] }).notNull(),
	shopifyExpectedDelta: integer('shopify_expected_delta').notNull(),
	shopifyActualDelta: integer('shopify_actual_delta'),
	shopifyResponseRaw: text('shopify_response_raw'),
	createdBy: text('created_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// A batch groups multiple purchase lines entered together — the common case
// being one supplier invoice covering several SKUs at once.
export const purchaseBatches = sqliteTable('purchase_batches', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	supplier: text('supplier'),
	purchaseDate: integer('purchase_date', { mode: 'timestamp' }).notNull(),
	note: text('note'),
	createdBy: text('created_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const purchases = sqliteTable('purchases', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	batchId: text('batch_id').references(() => purchaseBatches.id, { onDelete: 'cascade' }),
	variantId: text('variant_id').notNull(),
	productId: text('product_id').notNull(),
	productTitle: text('product_title').notNull(),
	variantTitle: text('variant_title'),
	sku: text('sku'),
	quantity: integer('quantity').notNull(),
	unitCost: text('unit_cost').notNull(),
	totalCost: text('total_cost').notNull(),
	purchaseDate: integer('purchase_date', { mode: 'timestamp' }).notNull(),
	note: text('note'),
	shopifyAdjustmentStatus: text('shopify_adjustment_status', { enum: ['success', 'failed'] }).notNull(),
	createdBy: text('created_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const damages = sqliteTable('damages', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storeId: text('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	variantId: text('variant_id').notNull(),
	productId: text('product_id').notNull(),
	productTitle: text('product_title').notNull(),
	variantTitle: text('variant_title'),
	sku: text('sku'),
	quantity: integer('quantity').notNull(),
	costAtDamageTime: text('cost_at_damage_time').notNull(),
	totalCost: text('total_cost').notNull(),
	reason: text('reason'),
	damageDate: integer('damage_date', { mode: 'timestamp' }).notNull(),
	shopifyAdjustmentStatus: text('shopify_adjustment_status', { enum: ['success', 'failed'] }).notNull(),
	createdBy: text('created_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// A manual monthly close — accounting reviews and records one month's sales
// at a time (e.g. closes June on July 1st), rather than tracking every sale
// as it happens. COGS uses each SKU's current average cost at close time,
// not a per-sale historical snapshot — deliberately simpler, matching how
// this store's books are actually kept.
export const monthlyCloses = sqliteTable(
	'monthly_closes',
	{
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		month: text('month').notNull(), // 'YYYY-MM'
		netSales: text('net_sales').notNull(),
		cogs: text('cogs').notNull(),
		unitsSold: integer('units_sold').notNull().default(0),
		closedBy: text('closed_by').notNull(),
		closedAt: integer('closed_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.storeId, table.month] })]
);

// --- Pricing tool ----------------------------------------------------------
// Per-variant cost input the merchant enters by hand (buying cost from the
// supplier, in whichever currency they were quoted). Everything else needed
// to compute a suggested price (current Shopify price/compare-at, live
// weight) is read fresh from Shopify each time, never cached here — so
// "pending changes" is always a live diff, not a state machine to keep in sync.
export const variantPricing = sqliteTable(
	'variant_pricing',
	{
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		variantId: text('variant_id').notNull(),
		productId: text('product_id').notNull(),
		costAmount: text('cost_amount').notNull().default('0'),
		costCurrency: text('cost_currency', { enum: ['cny', 'pkr'] }).notNull().default('cny'),
		// Overrides the live Shopify variant weight for the suggested-price
		// calculation; null means "use whatever weight Shopify has". Set on
		// apply so the two stay in sync going forward.
		weightGramsOverride: integer('weight_grams_override'),
		// Manual override of the computed suggested price/compare-at — null
		// means "use the formula's number". Lets the merchant hand-tune a
		// final price without touching cost/weight inputs.
		priceOverride: text('price_override'),
		compareAtOverride: text('compare_at_override'),
		updatedBy: text('updated_by').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.storeId, table.variantId] })]
);

// Manual "I've reviewed this product's pricing" tick per product card —
// purely a human bookkeeping aid (row presence = ticked), unrelated to the
// pending/apply-to-Shopify workflow. Cleared in bulk via the page's reset button.
export const pricingReviewMarks = sqliteTable(
	'pricing_review_marks',
	{
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		productId: text('product_id').notNull(),
		markedBy: text('marked_by').notNull(),
		markedAt: integer('marked_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.storeId, table.productId] })]
);

// Per-product override of the store's global shipping-cost/gram — for the
// handful of items (fragile, oversized) that genuinely cost more to ship
// than the rest of the catalog. Row presence = overridden; absence means
// "use the store-wide rate". Applies to every variant on that product.
export const pricingShippingOverrides = sqliteTable(
	'pricing_shipping_overrides',
	{
		storeId: text('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		productId: text('product_id').notNull(),
		shippingCostPerGram: text('shipping_cost_per_gram').notNull(),
		updatedBy: text('updated_by').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.storeId, table.productId] })]
);

export const auditLog = sqliteTable('audit_log', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	actorId: text('actor_id').notNull(),
	actorRole: text('actor_role', { enum: ['admin', 'dispatcher', 'accounting'] }).notNull(),
	action: text('action').notNull(),
	targetType: text('target_type'),
	targetId: text('target_id'),
	storeId: text('store_id').references(() => stores.id, { onDelete: 'set null' }),
	metadata: text('metadata'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
