<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { formatCurrency, formatDateShort } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);

	interface Line {
		id: string;
		productTitle: string;
		variantTitle: string | null;
		sku: string | null;
		quantity: number;
		unitCost: string;
	}

	let editing = $state<Line | null>(null);
	let confirmText = $state('');
	const confirmed = $derived(confirmText.trim().toLowerCase() === 'edit');
</script>

<svelte:head><title>Purchases — {data.storeName}</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h2 class="text-sm font-semibold text-foreground">Recent Purchases</h2>
			<p class="text-xs text-muted-foreground mt-0.5">Increases real Shopify inventory (on hand) at the store's location</p>
		</div>
		<Button href="/accounting/stores/{storeId}/purchases/new">
			<PlusIcon class="size-4" />
			Add Purchase
		</Button>
	</div>

	{#if data.batches.length === 0}
		<div class="card border-dashed p-8 text-center">
			<p class="text-sm text-muted-foreground">No purchases recorded yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.batches as batch}
				<div class="card overflow-hidden">
					<div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
						<div>
							<div class="text-sm font-semibold text-foreground">{batch.supplier || 'Purchase'}</div>
							<div class="text-xs text-muted-foreground">{formatDateShort(batch.purchaseDate.toString())} · {batch.lines.length} item{batch.lines.length !== 1 ? 's' : ''}</div>
						</div>
						<div class="text-sm font-semibold text-foreground">{formatCurrency(String(batch.totalCost), 'PKR')}</div>
					</div>
					<div class="divide-y divide-border">
						{#each batch.lines as line}
							<div class="flex items-center gap-3 px-4 py-2.5">
								<div class="flex-1 min-w-0">
									<div class="text-sm text-foreground truncate">{line.productTitle}{line.variantTitle ? ` · ${line.variantTitle}` : ''}</div>
									<div class="text-xs text-muted-foreground">
										{line.sku ?? 'no sku'} · qty {line.quantity} @ {formatCurrency(line.unitCost, 'PKR')}
									</div>
									{#if line.shopifyAdjustmentStatus === 'failed'}
										<div class="text-xs text-destructive mt-0.5">⚠ Shopify stock update failed for this line</div>
									{/if}
								</div>
								<div class="text-sm font-medium text-foreground shrink-0">{formatCurrency(line.totalCost, 'PKR')}</div>
								<Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground shrink-0" onclick={() => { editing = line; confirmText = ''; }}>
									<PencilIcon class="size-4" />
								</Button>
							</div>
						{/each}
					</div>
					{#if batch.note}
						<div class="px-4 py-2 text-xs text-muted-foreground border-t border-border italic">{batch.note}</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<Dialog.Root open={!!editing} onOpenChange={(o) => { if (!o) editing = null; }}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Edit Line</Dialog.Title>
			<Dialog.Description>
				{editing?.productTitle}{editing?.variantTitle ? ` · ${editing.variantTitle}` : ''} — updates Shopify stock by the difference and keeps the average cost in sync.
			</Dialog.Description>
		</Dialog.Header>
		{#if form?.error}
			<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
		{/if}
		{#if editing}
			<form
				method="POST"
				action="?/editLine"
				use:enhance={() => async ({ update, result }) => {
					await update();
					if (result.type === 'success') {
						editing = null;
						confirmText = '';
						addToast(form?.warning ?? 'Purchase line updated');
					}
				}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editing.id} />
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="edit-quantity">Quantity</Label>
						<Input id="edit-quantity" name="quantity" type="number" min="1" step="1" value={editing.quantity} required />
					</div>
					<div class="space-y-1.5">
						<Label for="edit-unitCost">Unit Cost</Label>
						<Input id="edit-unitCost" name="unitCost" type="number" min="0" step="0.01" value={editing.unitCost} required />
					</div>
				</div>
				<div class="space-y-1.5">
					<Label for="edit-confirm">Type <span class="font-mono font-semibold">edit</span> to confirm</Label>
					<Input id="edit-confirm" bind:value={confirmText} autocomplete="off" placeholder="edit" />
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => editing = null}>Cancel</Button>
					<Button type="submit" disabled={!confirmed}>Save Changes</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
