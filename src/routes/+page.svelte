<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	$effect(() => {
		if (data.session?.role === 'admin' && data.session.totpVerified) {
			goto('/admin');
		} else if (data.session?.role === 'dispatcher' && data.session.totpVerified) {
			// An unverified dispatcher session hasn't cleared 2FA yet — /login
			// picks the code step back up rather than bouncing them in.
			goto('/dispatcher');
		} else {
			goto('/login');
		}
	});
</script>
