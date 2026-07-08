<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Component } from 'svelte';

	let {
		icon: Icon,
		title,
		description,
		ctaLabel,
		ctaHref
	}: {
		icon: Component;
		title: string;
		description: string;
		ctaLabel?: string;
		ctaHref?: string;
	} = $props();
</script>

<div class="card p-12 text-center">
	<Icon class="size-12 mx-auto text-muted-foreground/40 mb-4" stroke-width={1.5} />
	<h3 class="font-semibold text-foreground mb-1">{title}</h3>
	<p class="text-sm text-muted-foreground mb-4">{description}</p>
	{#if ctaLabel && ctaHref}
		<Button href={ctaHref}>{ctaLabel}</Button>
	{/if}
</div>
