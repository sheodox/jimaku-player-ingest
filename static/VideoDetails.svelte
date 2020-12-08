<style>
	.panel {
		padding: 1rem;
		margin: 0.5rem;
		position: relative;
	}
	.failed {
		outline: 2px solid var(--accent-red);
	}
	.failed-message {
		position: absolute;
		top: 0.2rem;
		right: 0.2rem;
		color: var(--accent-red);
		text-transform: uppercase;
	}
    .modal-body {
		padding: 0 1rem 1rem 1rem;
	}
</style>
<div class="panel" class:failed={$videoProgress && $videoProgress.error}>
	<h2 title={details.videoPath}>{details.videoName}</h2>

	{#if $videoProgress && $videoProgress.error}
		<button class="failed-message" on:click={() => showError = true}>
			Processing Failed
		</button>
	{/if}

	<div class="f-row justify-content-between">
		<StreamDetails {details} />

		<VideoTranscodeProgress videoPath={details.videoPath} videoProgress={$videoProgress} />
	</div>
</div>

{#if showError}
	<Modal bind:visible={showError} title="Processing Error - {details.videoName}">
		<div class="modal-body">
			<p>
				{$videoProgress.error.message}
			</p>
			<pre>
			{$videoProgress.error.stack}
		</pre>
		</div>
	</Modal>
{/if}

<script>
	import StreamDetails from "./StreamDetails.svelte";
	import VideoTranscodeProgress from "./VideoTranscodeProgress.svelte";
	import {derived} from "svelte/store";
	import {progress} from "./progress";
	import {Modal} from 'sheodox-ui';

	export let details;
	let showError;

	const videoProgress = derived(progress, progress => {
		return progress?.tasks.find(t => t.videoPath === details.videoPath);
	});
</script>
