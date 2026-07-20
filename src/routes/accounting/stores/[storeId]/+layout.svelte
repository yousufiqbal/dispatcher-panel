<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const sectionLabels: Record<string, string> = {
		purchases: 'Purchases',
		damages: 'Damages',
		expenses: 'Operating Expenses'
	};

	const sectionIconPaths: Record<string, string> = {
		purchases: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.98-4.804 2.545-7.454a1.125 1.125 0 00-1.11-1.36H5.055M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
		damages: 'M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 9v3.75m0 3.75h.007v.008H12v-.008z',
		expenses: 'M12 6v1.5m0 9V18m3-8.25c0-1.036-1.343-1.875-3-1.875s-3 .84-3 1.875 1.343 1.875 3 1.875 3 .84 3 1.875-1.343 1.875-3 1.875-3-.84-3-1.875M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z'
	};

	const incomeStatementIconPath = 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z';

	const currentSection = $derived.by(() => {
		const segments = $page.url.pathname.split('/').filter(Boolean);
		const idx = segments.indexOf($page.params.storeId ?? '');
		return segments[idx + 1] ?? '';
	});

	const sectionLabel = $derived(sectionLabels[currentSection] ?? 'Income Statement');
	const sectionIconPath = $derived(sectionIconPaths[currentSection] ?? incomeStatementIconPath);
</script>

<div class="flex flex-col h-full">
	<!-- Page heading (desktop only — mobile has its own top bar with hamburger) -->
	<div class="hidden md:flex items-center gap-3 px-6 pt-5 pb-3">
		<div class="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d={sectionIconPath} />
			</svg>
		</div>
		<div>
			<h1 class="font-bold text-foreground text-lg leading-tight">{sectionLabel}</h1>
			<p class="text-xs text-muted-foreground leading-tight">{data.storeName}</p>
		</div>
	</div>

	<div class="flex-1 overflow-auto min-w-0">
		{@render children()}
	</div>
</div>
