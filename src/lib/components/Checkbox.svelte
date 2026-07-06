<script lang="ts">
	import { Checkbox } from 'bits-ui';

	let {
		checked = $bindable(false),
		onCheckedChange,
		class: className = ''
	}: {
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		class?: string;
	} = $props();
</script>

<Checkbox.Root
	bind:checked
	{onCheckedChange}
	class="inline-flex items-center justify-center size-5 shrink-0 rounded-md border border-border bg-card transition-colors cursor-pointer
		data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground
		hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
		{className}"
>
	{#snippet children({ checked })}
		{#if checked}
			<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		{/if}
	{/snippet}
</Checkbox.Root>
