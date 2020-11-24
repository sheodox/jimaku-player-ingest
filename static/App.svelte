<style>
	#toolbar {
		margin: 0.5rem;
	}
	.loading-message {
		text-align: center;
	}
</style>

<Header appName="Jimaku Player Ingest" />

<div class="page-content f-column">
	<div class="f-row panel justify-content-center" id="toolbar">
		<button on:click={() => detect(true)} disabled={!$detected}>
			<Icon icon="binoculars" />
			Rescan
		</button>
		<button on:click={convert} disabled={!$detected}>
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
		<p class="loading-message">
			Scanning video codecs, this might take a while.
		</p>
	{/if}
</div>

<Toasts />

<script>
	import {Header, Loading, Icon, Toasts} from 'sheodox-ui';
	import VideoDetails from "./VideoDetails.svelte";
	import {detected, detect} from "./video-details";
	import TranscodeProgress from './TranscodeProgress.svelte';

	function convert() {
		fetch('/video/transcode');
	}
</script>