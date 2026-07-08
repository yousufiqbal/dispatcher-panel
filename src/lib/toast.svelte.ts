import { toast } from 'svelte-sonner';

export function addToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
	if (type === 'error') toast.error(message);
	else if (type === 'info') toast(message);
	else toast.success(message);
}
