interface Toast {
	id: number;
	message: string;
	type: 'success' | 'error' | 'info';
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

export function addToast(message: string, type: Toast['type'] = 'success', duration = 3500) {
	const id = ++nextId;
	toasts.push({ id, message, type });
	setTimeout(() => {
		const idx = toasts.findIndex((t) => t.id === id);
		if (idx !== -1) toasts.splice(idx, 1);
	}, duration);
}

export function getToasts() {
	return toasts;
}

export function dismissToast(id: number) {
	const idx = toasts.findIndex((t) => t.id === id);
	if (idx !== -1) toasts.splice(idx, 1);
}
