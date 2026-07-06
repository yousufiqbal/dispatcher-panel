let open = $state(false);

export function openStoreSwitcher() {
	open = true;
}

export function closeStoreSwitcher() {
	open = false;
}

export function isStoreSwitcherOpen() {
	return open;
}
