{elapsed}

<script>
	import {onDestroy} from 'svelte';
	export let startTime;
	export let endTime;

	let elapsed = '';

	let frameRequest;
	function calculateElapsed() {
		elapsed = prettyTime((endTime ?? Date.now()) - startTime)

		if (!endTime) {
			frameRequest = requestAnimationFrame(calculateElapsed);
		}
	}
	calculateElapsed();

	function prettyTime(ms, forcePadHours=false) {
		const seconds = ms / 1000,
			hoursRemainder = seconds % 3600,
			hours = Math.floor((seconds / 3600)),
			minutesRemainder = hoursRemainder % 60,
			minutes = Math.floor(hoursRemainder / 60);
        const pad = num => Math.floor(num).toString().padStart(2, '0');
		return (hours > 0 || forcePadHours ? [hours, minutes, minutesRemainder] : [minutes, minutesRemainder])
			.map(pad).join(':');
	}

	onDestroy(() => {
		cancelAnimationFrame(frameRequest);
	})
</script>