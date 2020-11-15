<style>

</style>

<div>
	{#if $videoProgress}
		<TaskTime task={$videoProgress} />
		<label for={progressId} class="sr-only">
			Step
		</label>
		<Progress value={$videoProgress.done} max={$videoProgress.total} id={progressId}/>
	{/if}
</div>

<script>
	import {Progress} from 'sheodox-ui';
	import {derived} from 'svelte/store';
	import {progress} from './progress';
	import TaskTime from "./TaskTime.svelte";

	export let videoPath;
	const progressId = `${videoPath}-progress`;

	const videoProgress = derived(progress, progress => {
		return progress?.tasks.find(t => t.videoPath === videoPath);
	});
	videoProgress.subscribe(console.log);
</script>