<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/toast.svelte';
	import { formatCurrency, formatDateShort } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const storeId = $derived($page.params.storeId);

	let showAddExpense = $state(false);
	let showAddRecurring = $state(false);
	let confirmDeleteExpenseId = $state<string | null>(null);
	let confirmDeleteRecurringId = $state<string | null>(null);

	const total = $derived(data.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0));

	function changeMonth(delta: number) {
		const [y, m] = data.month.split('-').map(Number);
		const d = new Date(Date.UTC(y, m - 1 + delta, 1));
		const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		goto(`?month=${next}`, { keepFocus: true });
	}

	const todayStr = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>Operating Expenses — {data.storeName}</title></svelte:head>

<div class="p-3 sm:p-6 max-w-3xl mx-auto">
	<!-- Month nav + summary -->
	<div class="card p-5 mb-5 flex items-center justify-between gap-3">
		<Button variant="ghost" size="icon" onclick={() => changeMonth(-1)}>‹</Button>
		<div class="text-center">
			<div class="text-sm font-semibold text-foreground">
				{new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
			</div>
			<div class="text-xs text-muted-foreground mt-0.5">{data.expenses.length} expense{data.expenses.length !== 1 ? 's' : ''} · {formatCurrency(String(total), 'PKR')}</div>
		</div>
		<Button variant="ghost" size="icon" onclick={() => changeMonth(1)}>›</Button>
	</div>

	<div class="flex items-center justify-between mb-3">
		<h2 class="text-sm font-semibold text-foreground">Expenses this month</h2>
		<Button size="sm" onclick={() => showAddExpense = true}>
			<PlusIcon class="size-4" />
			Add Expense
		</Button>
	</div>

	{#if data.expenses.length === 0}
		<div class="card border-dashed p-8 text-center mb-6">
			<p class="text-sm text-muted-foreground">No expenses recorded for this month.</p>
		</div>
	{:else}
		<div class="card overflow-hidden divide-y divide-border mb-6">
			{#each data.expenses as exp}
				<div class="flex items-center gap-3 px-4 py-3">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-foreground">{exp.category}</span>
							{#if exp.recurringExpenseId}
								<RepeatIcon class="size-3 text-muted-foreground" />
							{/if}
						</div>
						{#if exp.description}<div class="text-xs text-muted-foreground truncate">{exp.description}</div>{/if}
						<div class="text-xs text-muted-foreground mt-0.5">{formatDateShort(exp.expenseDate.toString())}</div>
					</div>
					<div class="text-sm font-semibold text-foreground shrink-0">{formatCurrency(exp.amount, 'PKR')}</div>
					<Button variant="ghost" size="icon" class="text-muted-foreground hover:text-destructive shrink-0" onclick={() => confirmDeleteExpenseId = exp.id}>
						<Trash2Icon class="size-4" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Recurring expenses -->
	<div class="flex items-center justify-between mb-3">
		<h2 class="text-sm font-semibold text-foreground">Recurring Expenses</h2>
		<Button size="sm" variant="outline" onclick={() => showAddRecurring = true}>
			<PlusIcon class="size-4" />
			Add Recurring
		</Button>
	</div>

	{#if data.recurring.length === 0}
		<div class="card border-dashed p-8 text-center">
			<p class="text-sm text-muted-foreground">No recurring expenses set up. These auto-post into each month on the day you choose.</p>
		</div>
	{:else}
		<div class="card overflow-hidden divide-y divide-border">
			{#each data.recurring as r}
				<div class="flex items-center gap-3 px-4 py-3">
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium text-foreground">{r.category}</div>
						{#if r.description}<div class="text-xs text-muted-foreground truncate">{r.description}</div>{/if}
						<div class="text-xs text-muted-foreground mt-0.5">Posts on day {r.dayOfMonth} of each month</div>
					</div>
					<div class="text-sm font-semibold text-foreground shrink-0">{formatCurrency(r.amount, 'PKR')}</div>
					<form
						method="POST"
						action="?/toggleRecurring"
						use:enhance={() => async ({ update }) => { await update({ reset: false }); }}
					>
						<input type="hidden" name="id" value={r.id} />
						<input type="hidden" name="isActive" value={String(!r.isActive)} />
						<button type="submit" class="text-xs px-2 py-1 rounded-full font-medium {r.isActive ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600'}">
							{r.isActive ? 'Active' : 'Paused'}
						</button>
					</form>
					<Button variant="ghost" size="icon" class="text-muted-foreground hover:text-destructive shrink-0" onclick={() => confirmDeleteRecurringId = r.id}>
						<Trash2Icon class="size-4" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add expense -->
<Dialog.Root bind:open={showAddExpense}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add Expense</Dialog.Title>
			<Dialog.Description>Record a one-off operating expense.</Dialog.Description>
		</Dialog.Header>
		{#if form?.error}
			<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
		{/if}
		<form
			method="POST"
			action="?/addExpense"
			use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') { showAddExpense = false; addToast('Expense added'); }
			}}
			class="space-y-4"
		>
			<div class="space-y-1.5">
				<Label for="category">Category</Label>
				<Input id="category" name="category" placeholder="Rent, Salaries, Utilities…" required />
			</div>
			<div class="space-y-1.5">
				<Label for="description">Description (optional)</Label>
				<Input id="description" name="description" />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="amount">Amount</Label>
					<Input id="amount" name="amount" type="number" step="0.01" min="0" required />
				</div>
				<div class="space-y-1.5">
					<Label for="expenseDate">Date</Label>
					<Input id="expenseDate" name="expenseDate" type="date" value={todayStr} required />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => showAddExpense = false}>Cancel</Button>
				<Button type="submit">Add Expense</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Add recurring -->
<Dialog.Root bind:open={showAddRecurring}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add Recurring Expense</Dialog.Title>
			<Dialog.Description>Auto-posts as a new expense every month on the chosen day.</Dialog.Description>
		</Dialog.Header>
		{#if form?.error}
			<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{form.error}</div>
		{/if}
		<form
			method="POST"
			action="?/addRecurring"
			use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') { showAddRecurring = false; addToast('Recurring expense added'); }
			}}
			class="space-y-4"
		>
			<div class="space-y-1.5">
				<Label for="rec-category">Category</Label>
				<Input id="rec-category" name="category" placeholder="Rent, Salaries, Utilities…" required />
			</div>
			<div class="space-y-1.5">
				<Label for="rec-description">Description (optional)</Label>
				<Input id="rec-description" name="description" />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="rec-amount">Amount</Label>
					<Input id="rec-amount" name="amount" type="number" step="0.01" min="0" required />
				</div>
				<div class="space-y-1.5">
					<Label for="rec-day">Day of month</Label>
					<Input id="rec-day" name="dayOfMonth" type="number" min="1" max="28" value="1" required />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => showAddRecurring = false}>Cancel</Button>
				<Button type="submit">Add Recurring</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete expense confirm -->
<Dialog.Root open={!!confirmDeleteExpenseId} onOpenChange={(o) => { if (!o) confirmDeleteExpenseId = null; }}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete expense?</Dialog.Title>
			<Dialog.Description>This cannot be undone.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => confirmDeleteExpenseId = null}>Cancel</Button>
			<form
				method="POST"
				action="?/deleteExpense"
				use:enhance={() => async ({ update, result }) => {
					await update({ reset: false });
					confirmDeleteExpenseId = null;
					if (result.type === 'success') addToast('Expense deleted');
				}}
			>
				<input type="hidden" name="id" value={confirmDeleteExpenseId} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete recurring confirm -->
<Dialog.Root open={!!confirmDeleteRecurringId} onOpenChange={(o) => { if (!o) confirmDeleteRecurringId = null; }}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete recurring expense?</Dialog.Title>
			<Dialog.Description>Past posted expenses stay — only future auto-posting stops.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => confirmDeleteRecurringId = null}>Cancel</Button>
			<form
				method="POST"
				action="?/deleteRecurring"
				use:enhance={() => async ({ update, result }) => {
					await update({ reset: false });
					confirmDeleteRecurringId = null;
					if (result.type === 'success') addToast('Recurring expense deleted');
				}}
			>
				<input type="hidden" name="id" value={confirmDeleteRecurringId} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
