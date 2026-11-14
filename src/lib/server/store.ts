import { db } from '$lib/server/db';
import { stores } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { encrypt } from '$lib/server/crypto';

export type StoreRecord = typeof stores.$inferSelect;

// One store per deployment. Its Shopify connection comes from the
// environment (SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN); the DB row only
// holds what the panel itself edits (name, icon, restock lead times) and is
// what other tables point at. Every request reads it (hooks.server.ts), so
// it's cached briefly per server instance.
const TTL_MS = 30_000;
let cache: { store: StoreRecord | null; at: number } | null = null;

function envConnection(): { shopifyDomain: string; apiAccessToken: string } | null {
	const shopifyDomain = env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase();
	const apiAccessToken = env.SHOPIFY_ACCESS_TOKEN?.trim();
	return shopifyDomain && apiAccessToken ? { shopifyDomain, apiAccessToken } : null;
}

// Fresh deployment: create the row from the environment.
async function createFromEnv(conn: { shopifyDomain: string; apiAccessToken: string }): Promise<StoreRecord> {
	const [row] = await db
		.insert(stores)
		.values({
			name: conn.shopifyDomain.replace(/\.myshopify\.com$/, ''),
			shopifyDomain: conn.shopifyDomain,
			apiAccessToken: encrypt(conn.apiAccessToken)
		})
		.returning();
	return row;
}

export async function getStore(): Promise<StoreRecord | null> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.store;

	const conn = envConnection();
	let row = (await db.query.stores.findFirst({ where: eq(stores.isActive, true) })) ?? null;
	if (!row && conn) row = await createFromEnv(conn);

	// The environment wins over whatever the row holds; without it the row's
	// own (encrypted) connection is used. The Shopify client accepts either.
	const store = row && conn ? { ...row, ...conn } : row;
	cache = { store, at: Date.now() };
	return store;
}

export function invalidateStoreCache(): void {
	cache = null;
}
