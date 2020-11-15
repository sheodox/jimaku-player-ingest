<style>
	.panel {
		margin: 0.5rem;
		padding: 1rem;
		align-self: center;
	}
	.column + .column {
		margin-left: 0.5rem;
	}
</style>

{#if $progress}
	<div class="panel">
		<h2>Progress</h2>
		<div class="f-row">
			<div class="column">
				<label for="total-progress">Finished ({$progress.done}/{$progress.total})</label>
				<Progress value={$progress.done} max={$progress.total} id="total-progress"/>
				<TaskTime task={$progress} />
			</div>

			<table class="column">
				<tbody>
				<tr>
					<th scope="row">Video Copied</th>
					<td>{$progress.videoStreamsCopied}</td>
				</tr>
				<tr>
					<th scope="row">Video Transcoded</th>
					<td>{$progress.videoStreamsTranscoded}</td>
				</tr>
				<tr>
					<th scope="row">Audio Copied</th>
					<td>{$progress.audioStreamsCopied}</td>
				</tr>
				<tr>
					<th scope="row">Audio Transcoded</th>
					<td>{$progress.audioStreamsTranscoded}</td>
				</tr>
				<tr>
					<th scope="row">Subtitles Extracted</th>
					<td>{$progress.subtitleTracksExtracted}</td>
				</tr>
				<tr>
					<th scope="row">Subtitles Skipped</th>
					<td>{$progress.subtitleTracksSkipped}</td>
				</tr>
				</tbody>
			</table>
		</div>
	</div>
{/if}

<script>
	import {Progress} from 'sheodox-ui';
	import {progress} from "./progress";
	import TaskTime from "./TaskTime.svelte";
</script>