import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { inventoryItems } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select({ position: inventoryItems.position, productTitle: inventoryItems.productTitle, newStock: inventoryItems.newStock, skipped: inventoryItems.skipped })
		.from(inventoryItems)
		.where(eq(inventoryItems.sessionId, params.sessionId))
		.orderBy(asc(inventoryItems.position));

	const map = new Map<number, { index: number; title: string; done: boolean; skipped: boolean }>();
	for (const r of rows) {
		const existing = map.get(r.position);
		const done = r.newStock != null;
		if (!existing) map.set(r.position, { index: r.position, title: r.productTitle, done, skipped: r.skipped });
		else {
			if (done) existing.done = true;
			if (r.skipped) existing.skipped = true;
		}
	}
	// A variant that got recounted (real newStock) clears skipped on save, but
	// if only SOME variants of a multi-variant product were recounted, treat
	// the whole product as still needing a look rather than fully done.
	for (const p of map.values()) {
		if (p.done && p.skipped) p.skipped = false;
	}

	return json({ products: [...map.values()].sort((a, b) => a.index - b.index) });
};
