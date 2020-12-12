import './style/style.scss';
import App from './App.svelte';
import {progress, detection} from './progress';
import {createAutoExpireToast, createPersistentToast} from "sheodox-ui";

const app = new App({
		target: document.querySelector('#app-root')
	}),
	socket = io();

socket.on('progress', p => {
	progress.set(p)
});
socket.on('detectionProgress', p => {
	detection.set(p);
})

socket.on('error', e => {
	createAutoExpireToast({
		...e,
		variant: 'error'
	});
})
socket.on('criticalError', e => {
	createPersistentToast({
		...e,
		variant: 'error'
	});
});
