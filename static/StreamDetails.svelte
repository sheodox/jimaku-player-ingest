<style>
	/* no conversion needed */
    .good {
        color: limegreen;
    }
	/* can be converted */
	.ok {
		color: orange;
	}
	/* not supported */
    .bad {
        color: var(--accent-red);
    }
</style>

<div class="f-row">
	<table>
		<caption>Video Streams</caption>
		<thead>
		<tr>
			<th>Codec</th>
		</tr>
		</thead>
		<tbody>
		{#each details.videoStreams as stream}
			<tr>
				<td class={safeCodecs.video.includes(stream.codec_name) ? 'good' : 'ok'}>
					<abbr title={stream.codec_long_name}>{stream.codec_name}</abbr>
				</td>
			</tr>
		{/each}
		</tbody>
	</table>

	<table>
		<caption>Audio Streams</caption>
		<thead>
		<tr>
			<th>Codec</th>
			<th>Language</th>
			<th>Title</th>
		</tr>
		</thead>
		<tbody>
		{#each details.audioStreams as stream}
			<tr>
				<td class={safeCodecs.audio.includes(stream.codec_name) ? 'good' : 'ok'}>
					<abbr title={stream.codec_long_name}>{stream.codec_name}</abbr>
				</td>
				<td>{stream.tags.language ?? ''}</td>
				<td>{stream.tags.title ?? ''}</td>
			</tr>
		{/each}
		</tbody>
	</table>

	<table>
		<caption>Subtitle Streams</caption>
		<thead>
		<tr>
			<th>Codec</th>
			<th>Language</th>
			<th>Title</th>
		</tr>
		</thead>
		<tbody>
		{#each details.subtitleStreams as stream}
			<tr>
				<td class={safeCodecs.subtitle.includes(stream.codec_name) ? 'good' : 'bad'}>
					<abbr title={stream.codec_long_name}>{stream.codec_name}</abbr>
				</td>
				<td>{stream.tags.language ?? ''}</td>
				<td>{stream.tags.title ?? ''}</td>
			</tr>
		{/each}
		</tbody>
	</table>
</div>

<script>
	export let details;
	import {safeCodecs} from '../codecs';
</script>
