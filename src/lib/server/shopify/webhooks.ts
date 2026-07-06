import { shopifyRequest, type ShopifyClient } from './client';

const WEBHOOK_SUBSCRIPTION_CREATE = `
	mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
		webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
			webhookSubscription { id }
			userErrors { field message }
		}
	}
`;

interface WebhookSubscriptionCreateResult {
	webhookSubscriptionCreate: {
		webhookSubscription: { id: string } | null;
		userErrors: { field: string[]; message: string }[];
	};
}

export async function registerOrderCreateWebhook(client: ShopifyClient, callbackUrl: string): Promise<void> {
	const result = await shopifyRequest<WebhookSubscriptionCreateResult>(client, WEBHOOK_SUBSCRIPTION_CREATE, {
		topic: 'ORDERS_CREATE',
		webhookSubscription: { callbackUrl, format: 'JSON' }
	});

	const errors = result.webhookSubscriptionCreate.userErrors;
	// Shopify returns a "already exists" user error (not a thrown error) if a webhook
	// for this topic+address already exists — safe to ignore on reconnect/re-save.
	const alreadyExists = errors.some((e) => /already exists|taken/i.test(e.message));
	if (errors.length > 0 && !alreadyExists) {
		console.error('[Shopify webhook registration]', errors);
	}
}
