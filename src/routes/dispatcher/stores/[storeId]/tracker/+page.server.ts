import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { listTrackerOrders } from '$lib/server/shopify/tracker';
import { TRACKER_WINDOW_DAYS, type TrackerNote } from '$lib/tracker';
import { getAuthorizedStore } from '$lib/server/store-access';
import { db } from '$lib/server/db';
import { orderNotes } from '$lib/server/db/schema';
import { and, eq, inArray, desc } from 'drizzle-orm';

const MAX_NOTE_LENGTH = 500;

export const load: PageServerLoad = async ({ parent, params }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	const orders = await listTrackerOrders(client, TRACKER_WINDOW_DAYS);

	// Notes for the listed orders, newest first per order.
	const notesByOrder: Record<string, TrackerNote[]> = {};
	const ids = orders.map((o) => o.legacyId);
	for (let i = 0; i < ids.length; i += 500) {
		const rows = await db
			.select()
			.from(orderNotes)
			.where(and(eq(orderNotes.storeId, params.storeId), inArray(orderNotes.orderId, ids.slice(i, i + 500))))
			.orderBy(desc(orderNotes.createdAt));
		for (const r of rows) {
			(notesByOrder[r.orderId] ??= []).push({
				id: r.id,
				note: r.note,
				authorName: r.authorName,
				createdAt: r.createdAt.toISOString()
			});
		}
	}

	return { orders, notesByOrder, days: TRACKER_WINDOW_DAYS };
};

export const actions: Actions = {
	addNote: async ({ request, params, locals }) => {
		await getAuthorizedStore(locals.session, params.storeId);
		const session = locals.session!;
		const fd = await request.formData();
		const orderId = fd.get('orderId')?.toString() ?? '';
		const note = (fd.get('note')?.toString() ?? '').trim();
		if (!/^\d+$/.test(orderId)) return fail(400, { error: 'Invalid order' });
		if (!note) return fail(400, { error: 'Write a note first' });
		if (note.length > MAX_NOTE_LENGTH) return fail(400, { error: `Keep notes under ${MAX_NOTE_LENGTH} characters` });

		const [row] = await db
			.insert(orderNotes)
			.values({
				storeId: params.storeId,
				orderId,
				note,
				authorId: session.userId,
				authorName: session.user.role === 'dispatcher' ? session.user.name : 'Admin'
			})
			.returning();

		return {
			note: { id: row.id, note: row.note, authorName: row.authorName, createdAt: row.createdAt.toISOString() } satisfies TrackerNote,
			orderId
		};
	}
};
