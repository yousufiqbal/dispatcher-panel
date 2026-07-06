<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
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
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
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
		<div class="space-y-1.5 mb-5 max-w-md">
			<label class="label" for="pickupAddressCode">Pickup Address <span class="text-destructive">*</span></label>
			<select id="pickupAddressCode" bind:value={pickupAddressCode} class="input" required>
				<option value="" disabled>Select pickup address…</option>
				{#each data.pickupAddresses as addr}
					<option value={addr.addressCode}>
						{addr.cityName} — {addr.address}{addr.addressType ? ` · ${addr.addressType}` : ''} ({addr.contactPersonName})
					</option>
				{/each}
			</select>
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
										<svg class="size-4 text-green-600 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M1.5 12.75l4 4L14 8m-4.5 4.75l4 4L23 8" />
										</svg>
									{:else}
										<svg class="size-4 text-destructive inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									{/if}
								</td>
								<td class="px-2 py-1">
									<input name="customerName_{row.id}" bind:value={rows[i].customerName} class="input !h-8 text-xs py-1 min-w-[8rem]" />
								</td>
								<td class="px-2 py-1">
									<input name="customerPhone_{row.id}" bind:value={rows[i].customerPhone} maxlength="11" class="input !h-8 text-xs py-1 w-[6.5rem]" />
								</td>
								<td class="px-2 py-1">
									<textarea name="address1_{row.id}" bind:value={rows[i].address1} rows="2" class="input !h-auto text-xs py-1 min-w-[18rem] w-full resize-y"></textarea>
								</td>
								<td class="px-2 py-1">
									<input name="city_{row.id}" bind:value={rows[i].city} class="input !h-8 text-xs py-1 w-20" />
								</td>
								<td class="px-2 py-1">
									<input name="codAmount_{row.id}" bind:value={rows[i].codAmount} class="input !h-8 text-xs py-1 w-20" />
								</td>
								<td class="px-2 py-1">
									<input name="weight_{row.id}" bind:value={rows[i].weight} class="input !h-8 text-xs py-1 w-14" />
								</td>
								<td class="px-2 py-1">
									<input name="note_{row.id}" bind:value={rows[i].note} class="input !h-8 text-xs py-1 min-w-[8rem]" />
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
							<svg class="size-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M1.5 12.75l4 4L14 8m-4.5 4.75l4 4L23 8" />
							</svg>
						{:else}
							<svg class="size-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label class="text-xs text-muted-foreground" for="m-customerName_{row.id}">Customer</label>
						<input id="m-customerName_{row.id}" bind:value={rows[i].customerName} class="input text-sm" />
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1.5">
							<label class="text-xs text-muted-foreground" for="m-customerPhone_{row.id}">Phone</label>
							<input id="m-customerPhone_{row.id}" bind:value={rows[i].customerPhone} maxlength="11" class="input text-sm" />
						</div>
						<div class="space-y-1.5">
							<label class="text-xs text-muted-foreground" for="m-city_{row.id}">City</label>
							<input id="m-city_{row.id}" bind:value={rows[i].city} class="input text-sm" />
						</div>
					</div>
					<div class="space-y-1.5">
						<label class="text-xs text-muted-foreground" for="m-address1_{row.id}">Address</label>
						<textarea id="m-address1_{row.id}" bind:value={rows[i].address1} rows="2" class="input !h-auto text-sm resize-y"></textarea>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1.5">
							<label class="text-xs text-muted-foreground" for="m-codAmount_{row.id}">COD</label>
							<input id="m-codAmount_{row.id}" bind:value={rows[i].codAmount} class="input text-sm" />
						</div>
						<div class="space-y-1.5">
							<label class="text-xs text-muted-foreground" for="m-weight_{row.id}">Weight (g)</label>
							<input id="m-weight_{row.id}" bind:value={rows[i].weight} class="input text-sm" />
						</div>
					</div>
					<div class="space-y-1.5">
						<label class="text-xs text-muted-foreground" for="m-note_{row.id}">Note</label>
						<input id="m-note_{row.id}" bind:value={rows[i].note} class="input text-sm" />
					</div>
				</div>
			{/each}
		</div>

		<button type="submit" class="btn-primary" disabled={submitting || (data.pickupAddresses.length > 0 && !pickupAddressCode)}>
			{submitting ? 'Booking…' : `Book ${rows.length} Order${rows.length !== 1 ? 's' : ''} with ${data.courierLabel}`}
		</button>
	</form>
</div>
