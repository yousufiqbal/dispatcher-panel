<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	$effect(() => {
		if (data.session?.role === 'admin' && data.session.totpVerified) {
			goto('/admin');
		} else if (data.session?.role === 'dispatcher') {
			goto('/dispatcher');
		} else {
			goto('/login');
		}
	});
</script>
