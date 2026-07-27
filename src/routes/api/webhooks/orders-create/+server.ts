import { text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyShopifyWebhook } from '$lib/server/shopify/webhook-verify';
import { notifyStoreDispatchers } from '$lib/server/push/send';

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();
	const store = await verifyShopifyWebhook(request, rawBody);

	const order = JSON.parse(rawBody) as {
		name: string;
		customer?: { first_name?: string; last_name?: string };
		total_price?: string;
		currency?: string;
	};

	const customerName = order.customer
		? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(' ') || 'Guest'
		: 'Guest';

	await notifyStoreDispatchers(store.id, {
		title: `New order ${order.name}`,
		body: `${customerName} — ${order.total_price ?? ''} ${order.currency ?? ''}`.trim(),
		tag: order.name,
		url: `/dispatcher/stores/${store.id}/orders`
	});

	return text('ok');
};
