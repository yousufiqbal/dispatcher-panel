// Svelte action: calls `onOutside` when a pointerdown lands outside `node`.
// Used to close dropdown/popover menus — more robust than onmouseleave, which
// fires on any gap between a trigger button and an absolutely-positioned panel.
export function clickOutside(node: HTMLElement, onOutside: () => void) {
	function handleClick(event: PointerEvent) {
		if (!node.contains(event.target as Node)) onOutside();
	}
	document.addEventListener('pointerdown', handleClick, true);
	return {
		destroy() {
			document.removeEventListener('pointerdown', handleClick, true);
		}
	};
}
