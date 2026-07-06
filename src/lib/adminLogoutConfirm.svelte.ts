let open = $state(false);

export function openLogoutConfirm() {
	open = true;
}

export function closeLogoutConfirm() {
	open = false;
}

export function isLogoutConfirmOpen() {
	return open;
}
