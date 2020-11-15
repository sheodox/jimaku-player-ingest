<style>
	.panel {
		padding: 1rem;
		margin: 0.5rem;
	}
</style>
<div class="panel">
	<h2 title={details.videoPath}>{details.videoName}</h2>

	<div class="f-row justify-content-between">
		<StreamDetails {details} />

		<VideoTranscodeProgress videoPath={details.videoPath} />
	</div>
</div>

<script>
	import StreamDetails from "./StreamDetails.svelte";
	import VideoTranscodeProgress from "./VideoTranscodeProgress.svelte";

	export let details;
</script>
