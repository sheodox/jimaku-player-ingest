<style>
	/* no conversion needed */
    .good {
        color: var(--shdx-green-500);
    }
	/* can be converted */
	.ok {
		color: var(--shdx-orange-500);
	}
	/* not supported */
    .bad {
        color: var(--shdx-red-500);
    }
</style>

<div class="f-row align-items-start">
	<table>
		<caption>Video Streams</caption>
		<thead>
		<tr>
			<th>Codec</th>
			<th>Profile</th>
		</tr>
		</thead>
		<tbody>
		{#each details.videoStreams as stream}
			<tr>
				<td class={isGoodVideoCodec(stream) ? 'good' : 'ok'}>
					<abbr title={stream.codec_long_name}>{stream.codec_name}</abbr>
				</td>
				<td class={isGoodVideoProfile(stream) ? 'good' : 'ok'}>{stream.profile || ''}</td>
			</tr>
		{/each}
		</tbody>
	</table>

	<table>
		<caption>Audio Streams</caption>
		<thead>
		<tr>
			<th>Codec</th>
			<th>Profile</th>
			<th>Language</th>
			<th>Title</th>
		</tr>
		</thead>
		<tbody>
		{#each details.audioStreams as stream}
			<tr>
				<td class={isGoodAudioCodec(stream) ? 'good' : 'ok'}>
					<abbr title={stream.codec_long_name}>{stream.codec_name}</abbr>
					{#if parseFloat(stream.start_time) !== 0}
						<abbr class="ok" title="Audio that starts at a different time than the video needs to be corrected, resample requires transcoding even if the codec and profile are good.">
							desynced
						</abbr>
					{/if}
				</td>
				<td
					class={isGoodAudioProfile(stream) ? 'good' : 'ok'}
				>
					{stream.profile || ''}
				</td>
				<td>{stream.tags?.language ?? ''}</td>
				<td>{stream.tags?.title ?? ''}</td>
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
				<td>{stream.tags?.language ?? ''}</td>
				<td>{stream.tags?.title ?? ''}</td>
			</tr>
		{/each}
		</tbody>
	</table>
</div>

<script>
	export let details;
	console.log(details);
	import {
		safeCodecs,
		isGoodVideoCodec,
		isGoodVideoProfile,
		isGoodAudioCodec,
		isGoodAudioProfile,
	} from '../codecs';
</script>
