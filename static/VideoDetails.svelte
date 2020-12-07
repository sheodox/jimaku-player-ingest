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
</style>
<div class="panel" class:failed={$videoProgress && $videoProgress.failed}>
	<h2 title={details.videoPath}>{details.videoName}</h2>

	{#if $videoProgress && $videoProgress.failed}
		<span class="failed-message">
			Processing Failed
		</span>
	{/if}

	<div class="f-row justify-content-between">
		<StreamDetails {details} />

		<VideoTranscodeProgress videoPath={details.videoPath} videoProgress={$videoProgress} />
	</div>
</div>

<script>
	import StreamDetails from "./StreamDetails.svelte";
	import VideoTranscodeProgress from "./VideoTranscodeProgress.svelte";
	import {derived} from "svelte/store";
	import {progress} from "./progress";

	export let details;

	const videoProgress = derived(progress, progress => {
		return progress?.tasks.find(t => t.videoPath === details.videoPath);
	});
</script>
