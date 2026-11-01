import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { restockSessions, restockItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getShopifyClient } from '$lib/server/shopify/client';
import { fetchLiveStock } from '$lib/server/shopify/restock';
import { getRestockSession } from '$lib/server/restock-session';
import { calcRestock, type LiveStock } from '$lib/restock-calc';

export const load: PageServerLoad = async ({ params, locals }) => {
	const index = parseInt(params.productIndex, 10);
	if (isNaN(index) || index < 0) redirect(303, `../${params.sessionId}/0`);

	// position == product index, so read only this product's variants — keeps
	// each page navigation to a handful of rows instead of the whole session.
	const [{ store, restockSession: session, lead }, variants] = await Promise.all([
		getRestockSession(locals.session, params.storeId, params.sessionId),
		db
			.select()
			.from(restockItems)
			.where(and(eq(restockItems.sessionId, params.sessionId), eq(restockItems.position, index)))
			.orderBy(asc(restockItems.variantPosition), asc(restockItems.id))
	]);

	const totalProducts = session.totalProducts;
	if (index >= totalProducts || variants.length === 0) {
		redirect(303, `/dispatcher/stores/${params.storeId}/restock/${params.sessionId}/complete`);
	}

	// Stock is read live on every visit — a session is often worked days after
	// it was started, and orders placed in between change what's needed.
	let live: Map<string, LiveStock> | null = null;
	let stockError: string | null = null;
	try {
		live = await fetchLiveStock(getShopifyClient(store), variants.map((v) => v.variantId));
	} catch (e) {
		stockError = e instanceof Error ? e.message : 'Failed to load live stock from Shopify';
	}

	return {
		session,
		lead,
		stockError,
		variants: variants.map((v) => {
			const stock = live?.get(v.variantId) ?? null;
			return {
				...v,
				stock,
				calc: stock ? calcRestock({ s30: v.sales30, s60: v.sales60, s90: v.sales90 }, stock, lead) : null
			};
		}),
		productTitle: variants[0].productTitle,
		productImageUrl: variants[0].productImageUrl,
		index,
		totalProducts,
		prevIndex: index > 0 ? index - 1 : null,
		nextIndex: index < totalProducts - 1 ? index + 1 : null
	};
};

function parseMode(value: FormDataEntryValue | null): 'air' | 'sea' | null {
	return value === 'air' || value === 'sea' ? value : null;
}

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		await getRestockSession(locals.session, params.storeId, params.sessionId);
		const fd = await request.formData();
		const updates: Promise<unknown>[] = [];
		for (const [key, value] of fd.entries()) {
			if (!key.startsWith('actualRestock_')) continue;
			const id = key.slice('actualRestock_'.length);
			const parsed = parseInt(value as string, 10);
			const actual = value === '' || !Number.isFinite(parsed) ? null : Math.max(0, parsed);
			updates.push(
				db
					.update(restockItems)
					.set({ actualRestock: actual, restockMode: actual ? parseMode(fd.get(`mode_${id}`)) : null })
					.where(and(eq(restockItems.id, id), eq(restockItems.sessionId, params.sessionId)))
			);
		}
		await Promise.all(updates);
		return { success: true };
	},

	complete: async ({ params, locals }) => {
		await getRestockSession(locals.session, params.storeId, params.sessionId);
		await db.update(restockSessions).set({ completedAt: new Date() }).where(eq(restockSessions.id, params.sessionId));
		redirect(303, `/dispatcher/stores/${params.storeId}/restock/${params.sessionId}/complete`);
	}
};
