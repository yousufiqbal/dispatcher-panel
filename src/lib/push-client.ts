import { PUBLIC_VAPID_KEY } from '$env/static/public';

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64Safe);
	return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(): Promise<void> {
	if (typeof window === 'undefined') return;
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
	if (!PUBLIC_VAPID_KEY) return;

	if (Notification.permission === 'default') {
		await Notification.requestPermission();
	}
	if (Notification.permission !== 'granted') return;

	const registration = await navigator.serviceWorker.register('/push-sw.js');
	await navigator.serviceWorker.ready;

	let subscription = await registration.pushManager.getSubscription();
	if (!subscription) {
		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as BufferSource
		});
	}

	await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subscription.toJSON())
	});
}
