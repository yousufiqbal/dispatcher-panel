import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string, currency: string): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parseFloat(amount));
}

export function formatDate(dateStr: string): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(new Date(dateStr));
}

export function formatRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffDays === 0) return `Today, ${timeStr}`;
	if (diffDays === 1) return `Yesterday, ${timeStr}`;
	if (diffDays < 7) return `${diffDays} days ago`;
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

// Same buckets as formatRelativeDate, but splits the time onto its own line
// for Today/Yesterday instead of "Today, 3:45 PM" — used in dense table cells.
export function formatRelativeDateParts(dateStr: string): { label: string; time: string | null } {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffDays = Math.floor(diffMs / 86400000);

	const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

	if (diffMins < 1) return { label: 'Just now', time: null };
	if (diffMins < 60) return { label: `${diffMins}m ago`, time: null };
	if (diffDays === 0) return { label: 'Today', time: timeStr };
	if (diffDays === 1) return { label: 'Yesterday', time: timeStr };
	if (diffDays < 7) return { label: `${diffDays} days ago`, time: null };
	return { label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date), time: null };
}

// "15 July 2026 07:32 PM"
export function formatDateTimeLong(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	const day = d.getDate();
	const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d);
	const year = d.getFullYear();
	const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
	return `${day} ${month} ${year} ${time}`;
}

export function shopifyIdToNumber(gid: string): string {
	return gid.split('/').pop() ?? gid;
}

// shadcn-svelte component prop helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
