import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { variantPricing } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getAuthorizedStore } from '$lib/server/store-access';
import { getShopifyClient } from '$lib/server/shopify/client';
import { applyProductWeights, fetchLiveWeights } from '$lib/server/shopify/weights';
import { logAudit } from '$lib/server/audit';
import { MAX_APPLY_PRODUCTS, MAX_GRAMS, type WeightApplyRequest, type WeightApplyResponse } from '$lib/weights';

// The client drives one request per small batch of products so it can show
// real progress and retry only what failed.
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const store = await getAuthorizedStore(locals.session, params.storeId);
	const client = getShopifyClient(store);

	const body = (await request.json().catch(() => null)) as WeightApplyRequest | null;
	const products = (Array.isArray(body?.products) ? body!.products : [])
		.slice(0, MAX_APPLY_PRODUCTS)
		.map((p) => ({
			productId: String(p?.productId ?? ''),
			changes: (Array.isArray(p?.changes) ? p.changes : []).filter(
				(c) =>
					typeof c?.variantId === 'string' &&
					Number.isInteger(c.grams) && c.grams >= 0 && c.grams <= MAX_GRAMS &&
					Number.isInteger(c.expectedGrams)
			)
		}))
		.filter((p) => p.productId.startsWith('gid://shopify/Product/') && p.changes.length > 0);
	if (products.length === 0) throw error(400, 'No changes');

	const res: WeightApplyResponse = { applied: [], conflicts: [], failed: [] };
	const live = await fetchLiveWeights(client, products.flatMap((p) => p.changes.map((c) => c.variantId)));

	await Promise.all(
		products.map(async (p) => {
			const toApply = [];
			for (const c of p.changes) {
				const liveGrams = live.get(c.variantId);
				if (liveGrams === undefined) res.failed.push({ variantId: c.variantId, error: 'Variant not found' });
				else if (liveGrams === c.grams) res.applied.push(c.variantId); // already there
				else if (liveGrams !== c.expectedGrams) res.conflicts.push({ variantId: c.variantId, liveGrams });
				else toApply.push({ variantId: c.variantId, grams: c.grams });
			}
			try {
				await applyProductWeights(client, p.productId, toApply);
				res.applied.push(...toApply.map((u) => u.variantId));
			} catch (e) {
				const msg = e instanceof Error ? e.message : 'Update failed';
				res.failed.push(...toApply.map((u) => ({ variantId: u.variantId, error: msg })));
			}
		})
	);

	// Shopify is the source of truth for weight: drop any staged weight on the
	// admin Pricing tool for these variants so it reads the new live value
	// instead of pushing its stale copy back over it.
	if (res.applied.length > 0) {
		await db
			.update(variantPricing)
			.set({ weightGramsOverride: null })
			.where(and(eq(variantPricing.storeId, params.storeId), inArray(variantPricing.variantId, res.applied)));

		const changeById = new Map(products.flatMap((p) => p.changes.map((c) => [c.variantId, c])));
		await logAudit(locals.session!.userId, 'dispatcher', 'weights.apply', {
			targetType: 'store',
			targetId: params.storeId,
			storeId: params.storeId,
			metadata: {
				appliedCount: res.applied.length,
				failedCount: res.failed.length,
				conflictCount: res.conflicts.length,
				changes: res.applied.slice(0, 100).map((id) => {
					const c = changeById.get(id)!;
					return { variantId: id, from: c.expectedGrams, to: c.grams };
				})
			}
		});
	}

	return json(res);
};
