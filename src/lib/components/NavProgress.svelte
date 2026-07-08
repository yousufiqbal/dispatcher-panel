<script lang="ts">
	import { navigating } from '$app/stores';

	let width = $state(0);
	let visible = $state(false);
	let fading = $state(false);
	let showTimeout: ReturnType<typeof setTimeout>;
	let growInterval: ReturnType<typeof setInterval>;
	let fadeTimeout: ReturnType<typeof setTimeout>;

	$effect(() => {
		if ($navigating) {
			clearTimeout(fadeTimeout);
			showTimeout = setTimeout(() => {
				visible = true;
				fading = false;
				width = 20;
				growInterval = setInterval(() => {
					width = Math.min(width + (90 - width) * 0.1, 90);
				}, 200);
			}, 150);
		} else {
			clearTimeout(showTimeout);
			clearInterval(growInterval);
			if (visible) {
				width = 100;
				fading = true;
				fadeTimeout = setTimeout(() => {
					visible = false;
					width = 0;
					fading = false;
				}, 250);
			}
		}
		return () => {
			clearTimeout(showTimeout);
			clearInterval(growInterval);
		};
	});
</script>

{#if visible}
	<div class="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent">
		<div
			class="h-full bg-blue-500"
			style="width: {width}%; opacity: {fading ? 0 : 1}; transition-property: width, opacity; transition-duration: {fading ? '250ms' : '200ms'}; transition-timing-function: ease-out;"
		></div>
	</div>
{/if}
