{#if task}
	<table>
		<tbody>
			<tr>
				<th scope="row">
					Started
				</th>
				<td>
					{prettyDate(task.startTime)}
				</td>
			</tr>
			{#if task.endTime}
				<tr>
					<th scope="row">
						Finished
					</th>
					<td>
						{prettyDate(task.endTime)}
					</td>
				</tr>
			{/if}
			<tr>
				<th scope="row">
					Elapsed
				</th>
				<td class="f-row">
					<ElapsedTime startTime={task.startTime} endTime={task.endTime} />
					{#if !task.endTime}
						<Loading size="small" />
					{/if}
				</td>
			</tr>
			<slot name="extra-rows" />
		</tbody>
	</table>
{/if}

<script>
	import {Loading} from 'sheodox-ui';
	import ElapsedTime from "./ElapsedTime.svelte";
	export let task;

	function prettyDate(ms) {
		return new Date(ms).toLocaleString();
	}
</script>