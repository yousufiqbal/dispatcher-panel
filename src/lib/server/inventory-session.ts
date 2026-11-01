import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { inventorySessions, inventoryItems } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchLiveStock } from '$lib/server/shopify/restock';
import type { SessionData } from './session';

// Every audit load, action and endpoint goes through here: form actions and
// +server routes don't run the store layout's access check, so each one must
// confirm the dispatcher can see this store and that the session belongs to it.
// `unlocked` additionally refuses sessions already applied to Shopify.
export async function getInventorySession(
	session: SessionData | null,
	storeId: string,
	sessionId: string,
	opts: { unlocked?: boolean } = {}
) {
	const store = await getAuthorizedStore(session, storeId);
	const [auditSession] = await db
		.select()
		.from(inventorySessions)
		.where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.storeId, storeId)));
	if (!auditSession) error(404, 'Session not found');
	if (opts.unlocked && auditSession.appliedAt) error(403, 'This session was applied to Shopify and can no longer be edited.');
	return { store, auditSession };
}

// A count entry: a number, 'match' (dispatcher moved on without typing —
// the shelf matches Shopify) or null (cleared).
export type CountEntry = { id: string; value: number | 'match' | null };

// Stores counts against live Shopify on_hand read at save time, not the
// session-start snapshot: stock shipped between starting the session and
// counting this shelf is already gone from both the shelf and Shopify, so
// diffing against the old number would subtract it a second time on apply.
// An unchanged count keeps its original baseline — re-reading on_hand later
// would drift it away from the moment the shelf was actually counted.
export async function saveCounts(
	store: { shopifyDomain: string; apiAccessToken: string },
	sessionId: string,
	entries: CountEntry[]
): Promise<void> {
	if (entries.length === 0) return;

	const existing = await db
		.select({ id: inventoryItems.id, variantId: inventoryItems.variantId, newStock: inventoryItems.newStock })
		.from(inventoryItems)
		.where(and(eq(inventoryItems.sessionId, sessionId), inArray(inventoryItems.id, entries.map((e) => e.id))));
	const byId = new Map(existing.map((e) => [e.id, e]));

	const changed = entries.filter((e) => {
		const row = byId.get(e.id);
		if (!row) return false;
		if (e.value === 'match') return row.newStock == null;
		return e.value !== row.newStock;
	});
	if (changed.length === 0) return;

	const needLive = changed.filter((e) => e.value !== null).map((e) => byId.get(e.id)!.variantId);
	const live = needLive.length ? await fetchLiveStock(getShopifyClient(store), needLive) : new Map();

	await Promise.all(
		changed.map((e) => {
			const row = byId.get(e.id)!;
			if (e.value === null) {
				return db.update(inventoryItems).set({ newStock: null }).where(eq(inventoryItems.id, e.id));
			}
			const onHand = live.get(row.variantId)?.onHand;
			const counted = e.value === 'match' ? onHand ?? null : e.value;
			if (counted === null) return Promise.resolve();
			return db
				.update(inventoryItems)
				.set({
					newStock: counted,
					// A variant deleted from Shopify since the session started has no
					// live level; keep its old baseline (apply will report it).
					...(onHand !== undefined ? { currentStock: onHand } : {}),
					skipped: false
				})
				.where(eq(inventoryItems.id, e.id));
		})
	);
}
