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
	role: text('role', { enum: ['admin', 'dispatcher'] }).notNull(),
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
	position: integer('position').notNull().default(0),
	variantPosition: integer('variant_position').notNull().default(0)
});

export const auditLog = sqliteTable('audit_log', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	actorId: text('actor_id').notNull(),
	actorRole: text('actor_role', { enum: ['admin', 'dispatcher'] }).notNull(),
	action: text('action').notNull(),
	targetType: text('target_type'),
	targetId: text('target_id'),
	storeId: text('store_id').references(() => stores.id, { onDelete: 'set null' }),
	metadata: text('metadata'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
