import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { inventoryItems } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select({ position: inventoryItems.position, productTitle: inventoryItems.productTitle, newStock: inventoryItems.newStock })
		.from(inventoryItems)
		.where(eq(inventoryItems.sessionId, params.sessionId))
		.orderBy(asc(inventoryItems.position));

	const map = new Map<number, { index: number; title: string; done: boolean }>();
	for (const r of rows) {
		const existing = map.get(r.position);
		const done = r.newStock != null;
		if (!existing) map.set(r.position, { index: r.position, title: r.productTitle, done });
		else if (done) existing.done = true;
	}

	return json({ products: [...map.values()].sort((a, b) => a.index - b.index) });
};
