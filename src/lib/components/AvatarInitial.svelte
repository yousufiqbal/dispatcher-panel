<script lang="ts">
	let {
		name,
		src = null,
		size = 'size-10'
	}: {
		name: string;
		src?: string | null;
		size?: string;
	} = $props();
</script>

{#if src}
	<img {src} alt="" class="{size} rounded-lg object-contain border border-border shrink-0" />
{:else}
	<div class="{size} rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
		{name[0]?.toUpperCase()}
	</div>
{/if}
