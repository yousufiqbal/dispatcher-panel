<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { Snippet } from 'svelte';

	let {
		href,
		title,
		backTitle,
		subtitle,
		leading,
		meta
	}: {
		href: string;
		title: string;
		backTitle?: string;
		subtitle?: string;
		leading?: Snippet;
		meta?: Snippet;
	} = $props();
</script>

<div class="mb-6">
	<div class="flex items-center gap-3">
		<Button {href} variant="outline" size="icon" class="shrink-0" title={backTitle ?? `Back`}>
			<ArrowLeftIcon class="size-4" />
		</Button>
		{#if leading}
			{@render leading()}
		{/if}
		{#if meta}
			<div>
				<h1 class="text-2xl font-bold">{title}</h1>
				<div class="flex items-center gap-2 mt-1">
					{@render meta()}
				</div>
			</div>
		{:else}
			<h1 class="text-2xl font-bold">{title}</h1>
		{/if}
	</div>
	{#if subtitle}
		<p class="text-sm text-muted-foreground mt-1">{subtitle}</p>
	{/if}
</div>
