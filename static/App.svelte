<style>
	#toolbar {
		margin: 0.5rem;
	}
</style>

<Header appName="Jimaku Player Ingest" />

<div class="page-content f-column">
	<div class="f-row panel justify-content-center" id="toolbar">
		<button on:click={convert}>
			<Icon icon="clone"/>
			Convert
		</button>
	</div>

	<TranscodeProgress />

	{#if $detected}
		{#each $detected as details}
			<VideoDetails {details} />
		{/each}
	{:else}
		<Loading />
	{/if}
</div>

<Toasts />

<script>
	import {Header, Loading, Icon, Toasts} from 'sheodox-ui';
	import VideoDetails from "./VideoDetails.svelte";
	import {detected} from "./video-details";
	import TranscodeProgress from './TranscodeProgress.svelte';

	function convert() {
		fetch('/video/transcode');
	}
</script>