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
	shopifyDomain: text('shopify_domain').notNull().unique(),
	apiAccessToken: text('api_access_token').notNull(),
	oauthClientId: text('oauth_client_id'),
	oauthClientSecret: text('oauth_client_secret'),
	oauthRedirectUri: text('oauth_redirect_uri'),
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
