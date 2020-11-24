import {writable} from 'svelte/store';
import {createAutoExpireToast} from "sheodox-ui/components/toast";

export const detected = writable(null);

export function detect(force) {
	detected.set(null);
	fetch('/video/detect' + (force ? '?force=true' : ''))
		.then(res => {
			if (res.status === 409) {
				createAutoExpireToast({
					title: `Can't scan right now`,
					message: `You can't scan while video transcoding is in progress.`
				})
			}
			return res.json();
		})
		.then(d => {
			detected.set(d);
		})
}

detect();