import {
	pgTable,
	text,
	boolean,
	timestamp,
	uuid,
	primaryKey,
	pgEnum
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'dispatcher']);

export const admin = pgTable('admin', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	totpSecret: text('totp_secret'),
	totpEnabled: boolean('totp_enabled').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const dispatchers = pgTable('dispatchers', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const stores = pgTable('stores', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	nickname: text('nickname').notNull().unique(),
	shopifyDomain: text('shopify_domain').notNull().unique(),
	apiAccessToken: text('api_access_token').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const dispatcherStoreAccess = pgTable(
	'dispatcher_store_access',
	{
		dispatcherId: uuid('dispatcher_id')
			.notNull()
			.references(() => dispatchers.id, { onDelete: 'cascade' }),
		storeId: uuid('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		grantedAt: timestamp('granted_at').notNull().defaultNow()
	},
	(table) => [primaryKey({ columns: [table.dispatcherId, table.storeId] })]
);

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: uuid('user_id').notNull(),
	role: roleEnum('role').notNull(),
	totpVerified: boolean('totp_verified').notNull().default(false),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent')
});

export const auditLog = pgTable('audit_log', {
	id: uuid('id').primaryKey().defaultRandom(),
	actorId: uuid('actor_id').notNull(),
	actorRole: roleEnum('actor_role').notNull(),
	action: text('action').notNull(),
	targetType: text('target_type'),
	targetId: text('target_id'),
	storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
	metadata: text('metadata'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
