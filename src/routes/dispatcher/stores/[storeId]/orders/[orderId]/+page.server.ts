import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient, shopifyRequest } from '$lib/server/shopify/client';
import { getOrder, cancelOrder, confirmOrder, unconfirmOrder, fulfillOrder, cancelFulfillment, refundOrder, updateOrderShipping, updateOrderEmail, updateOrderNote, updateOrderTags } from '$lib/server/shopify/orders';
import { orderEditBegin, orderEditAddDiscount, orderEditCommit } from '$lib/server/shopify/order-edit';
import { cancelShipment, getCourierTrackingUrl } from '$lib/server/courier';
import { decrypt } from '$lib/server/crypto';
import { logAudit } from '$lib/server/audit';
import { getAuthorizedStore } from '$lib/server/store-access';
import { db } from '$lib/server/db';
import { couriers, courierStoreAccess, courierBookings } from '$lib/server/db/schema';
import { eq, and, or, ne, isNull, desc } from 'drizzle-orm';

function toShopifyOrderId(orderId: string): string {
	return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

// Newest non-cancelled booking for this order. Orders can accumulate stale duplicate
// rows (failed-then-retried bookings, old cancelled ones) — plain findFirst can land
// on a cancelled row and wrongly report "no active booking".
async function findActiveBooking(storeId: string, orderId: string) {
	return db.query.courierBookings.findFirst({
		where: and(
			eq(courierBookings.storeId, storeId),
			eq(courierBookings.orderId, orderId),
			or(isNull(courierBookings.status), ne(courierBookings.status, 'Cancelled'))
		),
		orderBy: desc(courierBookings.createdAt)
	});
}

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	const storeCouriers = await db
		.select({ id: couriers.id, name: couriers.name })
		.from(courierStoreAccess)
		.innerJoin(couriers, eq(couriers.id, courierStoreAccess.courierId))
		.where(and(eq(courierStoreAccess.storeId, params.storeId), eq(couriers.enabled, true)));

	// Delivery status is NOT read from the booking row — the tracking card shows
	// Shopify's fulfillment displayStatus (see the `delivery` derived in +page.svelte).
	const booking = await findActiveBooking(params.storeId, params.orderId);
	let activeBooking: { trackingId: string; courierName: string; trackingUrl: string | null } | null = null;
	if (booking && booking.trackingId) {
		const courier = booking.courierId
			? await db.query.couriers.findFirst({ where: eq(couriers.id, booking.courierId) })
			: null;
		const provider = courier?.provider ?? booking.provider;
		activeBooking = {
			trackingId: booking.trackingId,
			courierName: courier?.name ?? provider,
			trackingUrl: getCourierTrackingUrl(provider, booking.trackingId)
		};
	}

	try {
		const order = await getOrder(client, toShopifyOrderId(params.orderId));
		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.view', {
				targetType: 'order', targetId: params.orderId, storeId: params.storeId
			});
		}
		return { order, couriers: storeCouriers, booking: activeBooking };
	} catch (e) {
		throw error(404, 'Order not found');
	}
};

export const actions: Actions = {
	cancel: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const reason = (fd.get('reason') as string) || 'OTHER';
		const refund = fd.get('refund') === 'true';
		const restock = fd.get('restock') === 'true';
		const notify = fd.get('notify') === 'true';
		try {
			await cancelOrder(client, toShopifyOrderId(params.orderId), reason, refund, restock, notify);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.cancel', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId,
					metadata: { reason, refund, restock, notify }
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to cancel order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	confirm: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		try {
			await confirmOrder(client, toShopifyOrderId(params.orderId));
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.confirm', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to confirm order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders?status=pending`);
	},

	unconfirm: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		try {
			await unconfirmOrder(client, toShopifyOrderId(params.orderId));
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.unconfirm', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to unconfirm order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	fulfill: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const trackingNumber = (fd.get('trackingNumber') as string) || null;
		const trackingCompany = (fd.get('trackingCompany') as string) || null;

		try {
			await fulfillOrder(client, toShopifyOrderId(params.orderId), trackingNumber, trackingCompany);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.fulfill', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId,
					metadata: { trackingNumber, trackingCompany }
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to fulfill order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	// Cancels the courier shipment (if a local booking exists) and always reverts
	// the Shopify fulfillment. If there's no local booking (order fulfilled before
	// this app tracked bookings, or fulfilled manually), it just unfulfills.
	unbook: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);

		const booking = await findActiveBooking(params.storeId, params.orderId);
		const activeBooking = booking && booking.trackingId ? booking : null;

		let courierName: string | null = null;
		if (activeBooking) {
			if (!activeBooking.courierId) return fail(400, { error: 'Booking has no linked courier — cannot cancel automatically' });

			const courier = await db.query.couriers.findFirst({ where: eq(couriers.id, activeBooking.courierId) });
			if (!courier || !courier.apiKey) return fail(400, { error: 'Courier not found or missing API key' });
			courierName = courier.name;

			try {
				await cancelShipment(courier.provider, decrypt(courier.apiKey), activeBooking.trackingId);
			} catch (e: unknown) {
				return fail(400, { error: `Failed to cancel with courier: ${e instanceof Error ? e.message : 'Unknown error'}` });
			}

			await db
				.update(courierBookings)
				.set({ status: 'Cancelled', statusUpdatedAt: new Date() })
				.where(eq(courierBookings.id, activeBooking.id));
		}

		let warning: string | null = null;
		try {
			const order = await getOrder(client, toShopifyOrderId(params.orderId));
			const fulfillment = order.fulfillments.find((f: { id: string; status: string }) => f.status !== 'CANCELLED');
			if (fulfillment) await cancelFulfillment(client, fulfillment.id);
		} catch (e: unknown) {
			warning = activeBooking
				? `Courier shipment cancelled, but Shopify fulfillment could not be reverted: ${e instanceof Error ? e.message : 'Unknown error'}`
				: `Failed to unfulfill order: ${e instanceof Error ? e.message : 'Unknown error'}`;
			if (!activeBooking) return fail(400, { error: warning });
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.unbook', {
				targetType: 'order', targetId: params.orderId, storeId: params.storeId,
				metadata: { courier: courierName, trackingId: activeBooking?.trackingId ?? null, warning }
			});
		}

		return { unbooked: true, warning };
	},

	refund: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const note = (fd.get('note') as string) || '';
		const lineItemIds = fd.getAll('lineItemId') as string[];
		const quantities = fd.getAll('quantity') as string[];

		const refundLineItems = lineItemIds.map((id, i) => ({
			lineItemId: id,
			quantity: parseInt(quantities[i] ?? '1', 10),
			restockType: 'NO_RESTOCK'
		}));

		try {
			await refundOrder(client, toShopifyOrderId(params.orderId), refundLineItems, false, note);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.refund', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to refund order' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	updateShipping: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		try {
			await updateOrderShipping(client, toShopifyOrderId(params.orderId), {
				firstName: fd.get('firstName') as string,
				lastName: fd.get('lastName') as string,
				address1: fd.get('address1') as string,
				address2: (fd.get('address2') as string) || undefined,
				city: fd.get('city') as string,
				province: fd.get('province') as string,
				country: fd.get('country') as string,
				zip: fd.get('zip') as string,
				phone: (fd.get('phone') as string) || undefined
			});
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.updateShipping', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update shipping' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	updateEmail: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const email = (fd.get('email') as string) ?? '';

		try {
			await updateOrderEmail(client, toShopifyOrderId(params.orderId), email);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.updateEmail', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update contact information' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	updateNote: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const note = (fd.get('note') as string) ?? '';

		try {
			await updateOrderNote(client, toShopifyOrderId(params.orderId), note);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.updateNote', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update note' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	updateTags: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();
		const tagsRaw = (fd.get('tags') as string) ?? '';
		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

		try {
			await updateOrderTags(client, toShopifyOrderId(params.orderId), tags);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.updateTags', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update tags' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	applyDiscount: async ({ params, request, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		// One or more line items, each with its own percentage — order matches
		// the calculated order's line items 1:1 since neither list is reordered.
		const lineItemIds = fd.getAll('lineItemId') as string[];
		const percentages = fd.getAll('percentage') as string[];

		const selections = lineItemIds
			.map((id, i) => ({ id, percentage: parseFloat(percentages[i] ?? '0') }))
			.filter((s) => s.percentage > 0 && s.percentage <= 100);

		if (selections.length === 0) {
			return fail(400, { error: 'Select at least one item and enter a valid percentage (1–100)' });
		}

		try {
			const { calcOrderId, lineItems: calcLineItems } = await orderEditBegin(client, toShopifyOrderId(params.orderId));
			for (const sel of selections) {
				const origIdx = lineItemIds.indexOf(sel.id);
				const calcLineItemId = calcLineItems[origIdx]?.id ?? sel.id;
				await orderEditAddDiscount(client, calcOrderId, calcLineItemId, {
					value: sel.percentage,
					valueType: 'PERCENTAGE',
					description: `${sel.percentage}% off`
				});
			}
			await orderEditCommit(client, calcOrderId, false, `Applied discount to ${selections.length} item${selections.length === 1 ? '' : 's'}`);
			if (locals.session) {
				await logAudit(locals.session.userId, 'dispatcher', 'order.applyDiscount', {
					targetType: 'order', targetId: params.orderId, storeId: params.storeId,
					metadata: { selections }
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to apply discount' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	markAsPaid: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const orderId = toShopifyOrderId(params.orderId);
		const gql = `
			mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
				orderMarkAsPaid(input: $input) {
					order { id }
					userErrors { field message }
				}
			}
		`;
		try {
			const data = await shopifyRequest<{ orderMarkAsPaid: { userErrors: { field: string[]; message: string }[] } }>(client, gql, { input: { id: orderId } });
			if (data.orderMarkAsPaid.userErrors.length) {
				return fail(400, { error: data.orderMarkAsPaid.userErrors.map(e => e.message).join(', ') });
			}
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'order.markAsPaid', { targetType: 'order', targetId: params.orderId, storeId: params.storeId });
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to mark as paid' });
		}
		throw redirect(303, `/dispatcher/stores/${params.storeId}/orders/${params.orderId}`);
	},

	duplicateOrder: async ({ params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const order = await getOrder(client, toShopifyOrderId(params.orderId));

		const lineItems = order.lineItems.nodes
			.filter(item => item.variant?.id)
			.map(item => ({ variantId: item.variant!.id, quantity: item.quantity }));

		if (!lineItems.length) return fail(400, { error: 'No duplicatable line items found' });

		const input: Record<string, unknown> = { lineItems };

		if (order.customer?.id) input.customerId = order.customer.id;

		if (order.shippingAddress) {
			const [firstName, ...rest] = order.shippingAddress.name.split(' ');
			input.shippingAddress = {
				firstName,
				lastName: rest.join(' '),
				address1: order.shippingAddress.address1,
				city: order.shippingAddress.city,
				province: order.shippingAddress.province,
				country: order.shippingAddress.country,
				zip: order.shippingAddress.zip,
				phone: order.shippingAddress.phone ?? undefined
			};
		}

		const gql = `
			mutation draftOrderCreate($input: DraftOrderInput!) {
				draftOrderCreate(input: $input) {
					draftOrder { id legacyResourceId }
					userErrors { field message }
				}
			}
		`;

		let newId: string | undefined;
		try {
			const result = await shopifyRequest(client, gql, { input }) as any;
			const errors = result?.draftOrderCreate?.userErrors;
			if (errors?.length) return fail(400, { error: errors[0].message });
			newId = result?.draftOrderCreate?.draftOrder?.legacyResourceId;
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'order.duplicate', { targetType: 'order', targetId: params.orderId, storeId: params.storeId });
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Failed to duplicate order' });
		}
		if (newId) throw redirect(303, `/dispatcher/stores/${params.storeId}/draft-orders/${newId}`);
		return { success: true };
	},

	resendInvoice: async ({ params, locals, request }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const orderId = toShopifyOrderId(params.orderId);
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const gql = `
			mutation orderInvoiceSend($id: ID!, $email: EmailInput) {
				orderInvoiceSend(id: $id, email: $email) {
					order { id }
					userErrors { field message }
				}
			}
		`;
		try {
			const result = await shopifyRequest(client, gql, { id: orderId, email: { to: email } }) as any;
			const errors = result?.orderInvoiceSend?.userErrors;
			if (errors?.length) return fail(400, { error: errors[0].message });
			if (locals.session) await logAudit(locals.session.userId, 'dispatcher', 'order.resendInvoice', { targetType: 'order', targetId: params.orderId, storeId: params.storeId });
		} catch (e) {
			return fail(500, { error: 'Failed to send invoice' });
		}
		return { success: true };
	}
};
