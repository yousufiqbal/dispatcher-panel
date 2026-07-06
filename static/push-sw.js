self.addEventListener('push', (event) => {
	let payload = { title: 'New order', body: '' };
	try {
		payload = event.data.json();
	} catch {
		// ignore malformed payloads
	}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			data: { url: payload.url ?? '/' },
			vibrate: [200, 100, 200],
			requireInteraction: false
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url ?? '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if (client.url.includes(url) && 'focus' in client) return client.focus();
			}
			if (self.clients.openWindow) return self.clients.openWindow(url);
		})
	);
});
