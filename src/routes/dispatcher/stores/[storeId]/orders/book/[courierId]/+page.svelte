<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckCheckIcon from '@lucide/svelte/icons/check-check';
	import XIcon from '@lucide/svelte/icons/x';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
	const storeId = $derived($page.params.storeId);
	const ids = $derived(data.rows.map((r) => r.id).join(','));

	let rows = $state(data.rows.map((r) => ({ ...r })));
	let pickupAddressCode = $state('');
</script>

<svelte:head>
	<title>Book {data.courierLabel} — Booking</title>
</svelte:head>

<div class="p-3 sm:p-6">
	<a href="/dispatcher/stores/{storeId}/orders?status=confirmed" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 w-fit">
		<ArrowLeftIcon class="size-4" />
		Back to Confirmed
	</a>

	<h1 class="text-2xl font-bold mb-1">Book {data.courierLabel}</h1>
	<p class="text-sm text-muted-foreground mb-6">{rows.length} order{rows.length !== 1 ? 's' : ''} selected — edit any field below before booking</p>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">{form.error}</div>
	{/if}

	{#if data.cityWarnings.length > 0}
		<div class="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6">
			<p class="font-medium mb-1">City not in {data.courierLabel}'s delivery list:</p>
			<ul class="list-disc list-inside space-y-0.5">
				{#each data.cityWarnings as w}
					<li>{w.orderName} — "{w.city}"</li>
				{/each}
			</ul>
			<p class="text-xs text-amber-700 mt-1">Booking may still work, but double-check the address before proceeding.</p>
		</div>
	{/if}

	{#if data.pickupAddresses.length > 0}
		{@const pickupLabels = Object.fromEntries(data.pickupAddresses.map((a) => [a.addressCode, `${a.cityName} — ${a.address}${a.addressType ? ` · ${a.addressType}` : ''} (${a.contactPersonName})`]))}
		<div class="space-y-1.5 mb-5 max-w-md">
			<Label for="pickupAddressCode">Pickup Address <span class="text-destructive">*</span></Label>
			<Select.Root type="single" bind:value={pickupAddressCode}>
				<Select.Trigger id="pickupAddressCode" class="w-full">
					{pickupAddressCode ? pickupLabels[pickupAddressCode] : 'Select pickup address…'}
				</Select.Trigger>
				<Select.Content>
					{#each data.pickupAddresses as addr}
						<Select.Item value={addr.addressCode} label={pickupLabels[addr.addressCode]}>
							{pickupLabels[addr.addressCode]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<p class="text-xs text-muted-foreground">
				Pick the one marked "Pickup" or "Pickup/Return" — a plain "Return" or "Default" address will be rejected by PostEx.
			</p>
		</div>
	{:else}
		<div class="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-5">
			No pickup address found on your {data.courierLabel} account — add one in their merchant dashboard first.
		</div>
	{/if}

	<form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }}>
		<input type="hidden" name="ids" value={ids} />
		<input type="hidden" name="pickupAddressCode" value={pickupAddressCode} />

		<!-- Desktop: table -->
		<div class="card overflow-hidden mb-5 hidden sm:block">
			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-border bg-muted/30">
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Order</th>
							<th class="text-center px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Confirm</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Phone</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Address</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">City</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">COD</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Weight</th>
							<th class="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Note</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each rows as row, i}
							<tr>
								<td class="px-2 py-1 font-medium text-foreground whitespace-nowrap">{row.orderName}</td>
								<td class="px-2 py-1 text-center">
									{#if row.confirmed}
										<CheckCheckIcon class="size-4 text-green-600 inline-block" />
									{:else}
										<XIcon class="size-4 text-destructive inline-block" />
									{/if}
								</td>
								<td class="px-2 py-1">
									<Input name="customerName_{row.id}" bind:value={rows[i].customerName} class="!h-8 text-xs py-1 min-w-[8rem]" />
								</td>
								<td class="px-2 py-1">
									<Input name="customerPhone_{row.id}" bind:value={rows[i].customerPhone} maxlength={11} class="!h-8 text-xs py-1 w-[6.5rem]" />
								</td>
								<td class="px-2 py-1">
									<textarea name="address1_{row.id}" bind:value={rows[i].address1} rows="2" class="input !h-auto text-xs py-1 min-w-[18rem] w-full resize-y"></textarea>
								</td>
								<td class="px-2 py-1">
									<Input name="city_{row.id}" bind:value={rows[i].city} class="!h-8 text-xs py-1 w-20" />
								</td>
								<td class="px-2 py-1">
									<Input name="codAmount_{row.id}" bind:value={rows[i].codAmount} class="!h-8 text-xs py-1 w-20" />
								</td>
								<td class="px-2 py-1">
									<Input name="weight_{row.id}" bind:value={rows[i].weight} class="!h-8 text-xs py-1 w-14" />
								</td>
								<td class="px-2 py-1">
									<Input name="note_{row.id}" bind:value={rows[i].note} class="!h-8 text-xs py-1 min-w-[8rem]" />
									<input type="hidden" name="itemsCount_{row.id}" value={rows[i].itemsCount} />
									<input type="hidden" name="itemsDetail_{row.id}" value={rows[i].itemsDetail} />
									<input type="hidden" name="fragile_{row.id}" value={rows[i].fragile ? 'true' : 'false'} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile: cards -->
		<div class="space-y-3 mb-5 sm:hidden">
			{#each rows as row, i}
				<div class="card p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="font-medium text-sm text-foreground">{row.orderName}</span>
						{#if row.confirmed}
							<CheckCheckIcon class="size-4 text-green-600" />
						{:else}
							<XIcon class="size-4 text-destructive" />
						{/if}
					</div>

					<div class="space-y-1.5">
						<Label class="text-xs text-muted-foreground" for="m-customerName_{row.id}">Customer</Label>
						<Input id="m-customerName_{row.id}" bind:value={rows[i].customerName} />
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1.5">
							<Label class="text-xs text-muted-foreground" for="m-customerPhone_{row.id}">Phone</Label>
							<Input id="m-customerPhone_{row.id}" bind:value={rows[i].customerPhone} maxlength={11} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs text-muted-foreground" for="m-city_{row.id}">City</Label>
							<Input id="m-city_{row.id}" bind:value={rows[i].city} />
						</div>
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs text-muted-foreground" for="m-address1_{row.id}">Address</Label>
						<textarea id="m-address1_{row.id}" bind:value={rows[i].address1} rows="2" class="input !h-auto text-sm resize-y"></textarea>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1.5">
							<Label class="text-xs text-muted-foreground" for="m-codAmount_{row.id}">COD</Label>
							<Input id="m-codAmount_{row.id}" bind:value={rows[i].codAmount} />
						</div>
						<div class="space-y-1.5">
							<Label class="text-xs text-muted-foreground" for="m-weight_{row.id}">Weight (g)</Label>
							<Input id="m-weight_{row.id}" bind:value={rows[i].weight} />
						</div>
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs text-muted-foreground" for="m-note_{row.id}">Note</Label>
						<Input id="m-note_{row.id}" bind:value={rows[i].note} />
					</div>
				</div>
			{/each}
		</div>

		<Button type="submit" disabled={submitting || (data.pickupAddresses.length > 0 && !pickupAddressCode)}>
			{submitting ? 'Booking…' : `Book ${rows.length} Order${rows.length !== 1 ? 's' : ''} with ${data.courierLabel}`}
		</Button>
	</form>
</div>
