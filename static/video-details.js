import {writable} from 'svelte/store';

export const detected = new writable(null);

fetch('/video/detect')
	.then(res => res.json())
	.then(d => {
		detected.set(d);
	})