import type { ShopifyClient } from './client';
import { getOrder, cancelOrder } from './orders';
import { orderEditBegin, orderEditAddVariant, orderEditAddCustomItem, orderEditCommit } from './order-edit';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

/** Step 1 failed: nothing was moved and nothing was cancelled. */
export class MergeError extends Error {}

export interface MergeResult {
	/** Names of the orders merged into the main one (e.g. "#2441"). */
	mergedNames: string[];
	/**
	 * Orders whose items were moved but which couldn't be cancelled. The merge
	 * itself succeeded and can't be undone — these must be cancelled by hand,
	 * or they risk being fulfilled twice.
	 */
	failedCancels: string[];
}

/**
 * Moves every remaining item from `otherOrderIds` into `mainOrderId`, then
 * cancels the others. Accepts numeric ids or GIDs.
 *
 * Shared by the Orders page and Confirmer so there's one implementation of a
 * destructive operation.
 */
export async function mergeOrders(client: ShopifyClient, mainOrderId: string, otherOrderIds: string[]): Promise<MergeResult> {
	// Defensive dedupe — never cancel the order everything was merged into,
	// even if a caller passed it in both places.
	const mainGid = toShopifyOrderId(mainOrderId);
	const others = [...new Set(otherOrderIds.map(toShopifyOrderId))].filter((id) => id !== mainGid);
	if (others.length === 0) throw new MergeError('Select a main order and at least one other order to merge');

	// Step 1: move every item into the main order. If anything here throws,
	// nothing is cancelled — the merge simply didn't happen.
	let othersDetail: Awaited<ReturnType<typeof getOrder>>[];
	try {
		othersDetail = await Promise.all(others.map((id) => getOrder(client, id)));

		const { calcOrderId } = await orderEditBegin(client, mainGid);
		for (const other of othersDetail) {
			for (const item of other.lineItems.nodes) {
				if (item.currentQuantity <= 0) continue; // already removed on that order
				if (item.variant?.id) {
					await orderEditAddVariant(client, calcOrderId, item.variant.id, item.currentQuantity);
				} else {
					await orderEditAddCustomItem(
						client,
						calcOrderId,
						item.title,
						item.originalUnitPriceSet.shopMoney.amount,
						item.originalUnitPriceSet.shopMoney.currencyCode,
						item.currentQuantity
					);
				}
			}
		}
		await orderEditCommit(client, calcOrderId, false, `Merged from ${othersDetail.map((o) => o.name).join(', ')}`);
	} catch (e) {
		throw new MergeError(e instanceof Error ? `Merge failed, nothing was cancelled: ${e.message}` : 'Failed to merge orders');
	}

	// Step 2: only now that the merge is confirmed committed, cancel the other
	// orders — one at a time, so a single failure doesn't stop the rest. If some
	// fail to cancel, the merge itself already succeeded and can't be rolled
	// back, so we report exactly which ones still need manual cancellation
	// instead of silently leaving them active (which would risk double-fulfillment).
	// restock: true — orderEditAddVariant already committed fresh inventory for
	// these items against the main order, independently of the commitment this
	// order's own creation made. Restocking here releases that original
	// commitment so the merged quantity is only deducted once, not twice.
	const cancelResults = await Promise.allSettled(
		others.map((id) => cancelOrder(client, id, 'OTHER', false, true, false))
	);

	return {
		mergedNames: othersDetail.map((o) => o.name),
		failedCancels: cancelResults.flatMap((r, i) => (r.status === 'rejected' ? [othersDetail[i].name] : []))
	};
}
