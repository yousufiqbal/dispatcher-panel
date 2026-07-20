<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PackageIcon from '@lucide/svelte/icons/package';
	import UserIcon from '@lucide/svelte/icons/user';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';

	type Scope = 'orders' | 'products' | 'customers';

	const SCOPES: { key: Scope; label: string }[] = [
		{ key: 'orders', label: 'Orders' },
		{ key: 'products', label: 'Products' },
		{ key: 'customers', label: 'Customers' }
	];

	const SCOPE_ICON = { orders: ShoppingBagIcon, products: PackageIcon, customers: UserIcon };

	let scope = $state<Scope>('orders');
	let query = $state('');
	let results = $state<{ id: string; title: string; subtitle: string; url: string }[]>([]);
	let loading = $state(false);
	let open = $state(false);
	let activeIndex = $state(-1);
	let containerEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let requestId = 0;

	// Persist the last-used scope across page navigations, but not across a full
	// reload of a different store — session-scoped, not permanent.
	$effect(() => {
		try {
			const saved = sessionStorage.getItem('globalSearchScope') as Scope | null;
			if (saved && SCOPES.some((s) => s.key === saved)) scope = saved;
		} catch {
			/* sessionStorage unavailable */
		}
	});

	function setScope(next: Scope) {
		scope = next;
		try {
			sessionStorage.setItem('globalSearchScope', next);
		} catch {
			/* sessionStorage unavailable */
		}
		if (query.trim()) runSearch();
	}

	const storeId = $derived($page.params.storeId as string | undefined);

	// Default the scope to whichever section (Orders/Products/Customers) the
	// dispatcher is currently viewing — still freely changeable from the dropdown,
	// it just re-syncs on the next navigation into one of those sections.
	const routeScope = $derived.by((): Scope | null => {
		const segments = $page.url.pathname.split('/').filter(Boolean);
		const idx = storeId ? segments.indexOf(storeId) : -1;
		const section = idx >= 0 ? segments[idx + 1] : undefined;
		return section === 'orders' || section === 'products' || section === 'customers' ? section : null;
	});

	$effect(() => {
		if (routeScope) scope = routeScope;
	});

	// Ctrl/Cmd+K focuses search from anywhere in the dispatcher panel.
	$effect(() => {
		function onKeydown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				inputEl?.focus();
			}
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	async function runSearch() {
		const q = query.trim();
		if (!q || !storeId) {
			results = [];
			open = false;
			return;
		}
		const thisRequest = ++requestId;
		loading = true;
		try {
			const res = await fetch(`/api/dispatcher/stores/${storeId}/search?q=${encodeURIComponent(q)}&scope=${scope}`);
			if (thisRequest !== requestId) return; // a newer request superseded this one
			const data = await res.json();
			results = data.results ?? [];
			activeIndex = -1;
			open = true;
		} catch {
			if (thisRequest === requestId) results = [];
		} finally {
			if (thisRequest === requestId) loading = false;
		}
	}

	function onInput() {
		clearTimeout(searchTimeout);
		if (!query.trim()) {
			results = [];
			open = false;
			return;
		}
		searchTimeout = setTimeout(runSearch, 300);
	}

	function selectResult(r: { url: string }) {
		open = false;
		query = '';
		results = [];
		goto(r.url);
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open || results.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + results.length) % results.length;
		} else if (e.key === 'Enter') {
			if (activeIndex >= 0) {
				e.preventDefault();
				selectResult(results[activeIndex]);
			} else if (results.length === 1) {
				e.preventDefault();
				selectResult(results[0]);
			}
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	$effect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			if (containerEl && !containerEl.contains(e.target as Node)) open = false;
		}
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	// Reset on store switch so stale results from a different store never show.
	$effect(() => {
		storeId;
		query = '';
		results = [];
		open = false;
	});
</script>

{#if storeId}
	<div bind:this={containerEl} class="relative w-full max-w-md">
		<div class="flex items-center rounded-lg border border-input bg-background shadow-xs overflow-hidden focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:border-ring">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							class="flex items-center gap-1 pl-3 pr-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border-r border-input shrink-0 whitespace-nowrap"
						>
							{SCOPES.find((s) => s.key === scope)?.label}
							<ChevronDownIcon class="size-3.5" />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="w-36">
					{#each SCOPES as s}
						{@const Icon = SCOPE_ICON[s.key]}
						<DropdownMenu.Item onclick={() => setScope(s.key)} class={scope === s.key ? 'bg-accent' : ''}>
							<Icon class="size-3.5" />
							{s.label}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<div class="relative flex-1 min-w-0">
				<SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
				<Input
					bind:ref={inputEl}
					type="search"
					placeholder="Search {SCOPES.find((s) => s.key === scope)?.label.toLowerCase()}…"
					class="border-0 shadow-none pl-8 h-9 focus-visible:ring-0"
					bind:value={query}
					oninput={onInput}
					onkeydown={onKeydown}
					onfocus={() => { if (results.length > 0) open = true; }}
				/>
				{#if loading}
					<Loader2Icon class="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin" />
				{/if}
			</div>
		</div>

		{#if open}
			<div class="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
				{#if loading && results.length === 0}
					<div class="px-3 py-3 text-sm text-muted-foreground">Searching…</div>
				{:else if results.length === 0}
					<div class="px-3 py-3 text-sm text-muted-foreground">No {SCOPES.find((s) => s.key === scope)?.label.toLowerCase()} found</div>
				{:else}
					<ul class="max-h-80 overflow-y-auto py-1">
						{#each results as r, i}
							<li>
								<button
									type="button"
									class="w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-sm hover:bg-accent {activeIndex === i ? 'bg-accent' : ''}"
									onmouseenter={() => activeIndex = i}
									onclick={() => selectResult(r)}
								>
									<span class="font-medium text-foreground truncate">{r.title}</span>
									<span class="text-xs text-muted-foreground truncate shrink-0 max-w-[45%]">{r.subtitle}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
{/if}
