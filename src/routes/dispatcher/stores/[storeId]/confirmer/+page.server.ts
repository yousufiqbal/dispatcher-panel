import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopifyClient } from '$lib/server/shopify/client';
import { getAuthorizedStore } from '$lib/server/store-access';
import { listEasyConfirmOrders, moveOrders, updateEasyConfirmAddress } from '$lib/server/shopify/easy-confirm';
import { logAudit } from '$lib/server/audit';
import { mergeOrders } from '$lib/server/shopify/merge';
import {
	BETWEEN_NOTE_MAX,
	BETWEEN_OTHER_TAG,
	BETWEEN_TAGS,
	betweenLabel,
	type AddressFields,
	type EasyConfirmTab
} from '$lib/easy-confirm';
import { DEFAULT_TRACKER_WINDOW, MAX_TRACKER_WINDOW } from '$lib/tracker';

const ORDER_GID = /^gid:\/\/shopify\/Order\/\d+$/;
const STATES: EasyConfirmTab[] = ['pending', 'between', 'confirmed'];

export const load: PageServerLoad = async ({ parent, url }) => {
	const { currentStore } = await parent();
	const client = getShopifyClient(currentStore);

	// Same windows as Tracker (30/60/120 buttons, any ?days= up to a year),
	// but by order date. Garbage falls back to the default.
	const requested = Number(url.searchParams.get('days'));
	const days = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, MAX_TRACKER_WINDOW) : DEFAULT_TRACKER_WINDOW;

	const orders = await listEasyConfirmOrders(client, days);
	return { orders, days };
};

export const actions: Actions = {
	// Move one or many orders to Pending, Between (with a reason) or Confirmed.
	move: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		const to = String(fd.get('to') ?? '') as EasyConfirmTab;
		if (!STATES.includes(to)) return fail(400, { error: 'Unknown action' });
		const ids = [...new Set(fd.getAll('id').map(String).filter((id) => ORDER_GID.test(id)))];
		if (ids.length === 0) return fail(400, { error: 'No orders selected' });

		const reasonTag = String(fd.get('reason') ?? '');
		const note = String(fd.get('note') ?? '').trim();
		if (to === 'between') {
			if (!BETWEEN_TAGS.includes(reasonTag)) return fail(400, { error: 'Pick a reason' });
			if (reasonTag === BETWEEN_OTHER_TAG && !note) return fail(400, { error: 'Type a reason for "Other"' });
			if (note.length > BETWEEN_NOTE_MAX) return fail(400, { error: `Keep the reason under ${BETWEEN_NOTE_MAX} characters` });
		}

		const { failed } = await moveOrders(client, ids, { state: to, reasonTag, note });
		const done = ids.filter((id) => !failed.includes(id));

		if (locals.session && done.length > 0) {
			const action =
				to === 'confirmed'
					? done.length > 1
						? 'order.bulkConfirm'
						: 'order.confirm'
					: to === 'between'
						? 'order.between'
						: 'order.backToPending';
			await logAudit(locals.session.userId, 'dispatcher', action, {
				targetType: 'order',
				targetId: done.length === 1 ? done[0].split('/').pop() : undefined,
				storeId: params.storeId,
				metadata: {
					via: 'confirmer',
					count: done.length,
					orderIds: done.map((id) => id.split('/').pop()),
					...(to === 'between' ? { reason: betweenLabel(reasonTag), ...(note ? { note } : {}) } : {})
				}
			});
		}

		return { to, count: done.length, failed };
	},

	// Merge several orders from the same customer into one, cancelling the rest.
	merge: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		const mainId = String(fd.get('mainId') ?? '');
		const otherIds = [...new Set(fd.getAll('otherId').map(String))].filter((id) => ORDER_GID.test(id) && id !== mainId);
		if (!ORDER_GID.test(mainId) || otherIds.length === 0) {
			return fail(400, { error: 'Pick a main order and at least one other order to merge' });
		}

		let result: Awaited<ReturnType<typeof mergeOrders>>;
		try {
			result = await mergeOrders(client, mainId, otherIds);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to merge orders' });
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.merge', {
				targetType: 'order',
				targetId: mainId.split('/').pop(),
				storeId: params.storeId,
				metadata: {
					via: 'confirmer',
					mergedFrom: otherIds.map((id) => id.split('/').pop()),
					cancelFailures: result.failedCancels
				}
			});
		}

		// A partial result is still a success for the merge itself — the client
		// warns about any order that still needs cancelling by hand.
		return { merged: result.mergedNames, failedCancels: result.failedCancels };
	},

	address: async ({ request, params, locals }) => {
		const store = await getAuthorizedStore(locals.session, params.storeId);
		const client = getShopifyClient(store);
		const fd = await request.formData();

		const id = String(fd.get('id') ?? '');
		let address: AddressFields | null;
		try {
			address = JSON.parse(String(fd.get('address') ?? ''));
		} catch {
			address = null;
		}
		if (!ORDER_GID.test(id) || !address) return fail(400, { error: 'Invalid address' });
		if (!address.address1?.trim() || !address.city?.trim()) return fail(400, { error: 'Address and city are required' });

		try {
			await updateEasyConfirmAddress(client, id, address);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : "Couldn't update address" });
		}

		if (locals.session) {
			await logAudit(locals.session.userId, 'dispatcher', 'order.updateShipping', {
				targetType: 'order',
				targetId: id.split('/').pop(),
				storeId: params.storeId,
				metadata: { via: 'confirmer' }
			});
		}
		return { addressSaved: true };
	}
};
