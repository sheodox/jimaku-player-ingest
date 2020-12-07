<style>

</style>

<div>
	{#if videoProgress}
		<TaskTime task={videoProgress} />
		<label for={progressId} class="sr-only">
			Step
		</label>
		<Progress value={videoProgress.done} max={videoProgress.total} id={progressId}/>
	{/if}
</div>

<script>
	import {Progress} from 'sheodox-ui';
	import TaskTime from "./TaskTime.svelte";

	export let videoPath;
	export let videoProgress;
	const progressId = `${videoPath}-progress`;
</script>