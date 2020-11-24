const {promisify} = require('util'),
	fs = require('fs').promises,
	path = require('path'),
	child_process = require('child_process'),
	exec = promisify(child_process.exec),
	mkdirp = require('mkdirp'),
	glob = promisify(require('glob')),
	{safeCodecs} = require('./codecs');


function translateMediaInfoSubtitleFormat(format) {
	return {
		'S_TEXT/WEBVTT': 'webvtt',
		'ASS': 'ass'
	}[format] || format.toLowerCase();
}

function getSubtitleExtension(format) {
	//the extension and the format might not be the same, try and correct that
	return {
		subrip: 'srt',
		webvtt: 'vtt'
	}[format] || format.toLowerCase();
}

//ensure source and destination directories exist, even if the first run means they contain nothing, the directories will be set up
async function detect() {
	await mkdirp('./videos/src');
	await mkdirp('./temp');
	await mkdirp('./videos/dest');

	const videos = await glob(`./videos/src/**/*.mkv`),
		detected = [];

	for (let i = 0; i < videos.length; i++) {
		const videoPath = videos[i],
			//collect information on the audio and video streams
			streamProbe = JSON.parse((await exec(`ffprobe -v error -show_streams "${videoPath}" -print_format json`)).stdout),
			audioProbe = JSON.parse((await exec(`ffprobe -v error -show_streams -select_streams a "${videoPath}" -print_format json`)).stdout),
			videoProbe = JSON.parse((await exec(`ffprobe -v error -show_streams -select_streams v "${videoPath}" -print_format json`)).stdout),
			subtitleProbe = JSON.parse((await exec(`ffprobe -v error -show_streams -select_streams s "${videoPath}" -print_format json`)).stdout),
			streams = streamProbe.streams,
			audioStreams = audioProbe.streams,
			videoStreams = videoProbe.streams,
			subtitleStreams = subtitleProbe.streams;

		const mediaInfoOutput = (await exec(`mediainfo "${videoPath}" --Inform="Text;%ID%,%Format%|"`)).stdout,
			mediaInfoCodecNames = new Map(mediaInfoOutput
				.trim()
				.split('|')
				.filter(stream => !!stream)
				.map(stream => {
					const [id, format] = stream.split(',');
					// it seems that mediainfo considers the container to be ID=0, so the mediainfo stream IDs are one higher
					// than the respective ffprobe stream indices
					return [parseInt(id, 10) - 1, translateMediaInfoSubtitleFormat(format)];
				}));

		for (const stream of subtitleStreams) {
			//sometimes ffprobe doesn't know the subtitle format, fall back to using `mediainfo`
			if (typeof stream.codec_name === 'undefined') {
				stream.codec_name = mediaInfoCodecNames.get(stream.index);
			}
		}

		detected.push({
			videoName: path.basename(videoPath),
			videoNameBase: path.basename(videoPath, path.extname(videoPath)),
			videoPath,
			streamProbe,
			audioProbe,
			videoProbe,
			subtitleProbe,
			streams,
			audioStreams,
			videoStreams,
			subtitleStreams
		});
	}

	return detected;
}

function runffmpeg(args) {
	const ffmpegArgs = [
		`-loglevel warning`,
		...args
	];

	return new Promise((resolve, reject) => {
		console.log(ffmpegArgs.join(' '));
		const child = child_process.spawn(`ffmpeg`, ffmpegArgs, {shell: true});

		child.stdout.on('data', data => console.log(data.toString()));
		//ffmpeg logs progress information (including speed) to stderr, ignore it while it's processing or it's just a lot of unnecessary
		//logging, but save the last thing that was logged so we can log later, the progress logs include a speed factor comparing the
		//speed of the ffmpeg operation to the length of the source media, nice to know how fast or slow it's going so we log this once later
		let lastProgress = '';
		child.stderr.on('data', data => lastProgress = data.toString());

		child.on('close', code => {
			console.log(lastProgress);

			code === 0 ? resolve() : reject(new Error(lastProgress));
		})
	});
}

let converting = false;
async function tryConvert(onStart, onProgress, onError, onCriticalError) {
	if (converting) {
		onError(new Error(`Already transcoding!`));
		return;
	}

	converting = true;
	//don't want to mix in new videos with the previously output stuff, plus without -y ffmpeg
	//will stall asking if files should be overwritten, but this doesn't use that.
	const destVideos = await glob('./videos/dest/**/*.mp4');
	if (destVideos.length) {
		converting = false;
		onError(new Error(`Transcode destination has videos, clean it out first before running!`));
		return;
	}

	onStart();

	//this takes a long time, onProgress will emit occasional progress events to the browser,
	//so dont await this. the caller only cares if it started or not
	await convert(onProgress)
		.then(() => {
			converting = false;
		})
		.catch((e) => {
			onCriticalError(e);
			converting = false;
		})
}

async function convert(onProgress) {
	//cumulative stats for how long everything takes and what was needed
	const progress = {
		done: 0,
		total: 1,
		startTime: Date.now(),
		// details about what was/is transcoded and how long it took, etc
		tasks: [],
		videoStreamsTranscoded: 0,
		videoStreamsCopied: 0,
		audioStreamsTranscoded: 0,
		audioStreamsCopied: 0,
		subtitleTracksExtracted: 0,
		subtitleTracksSkipped: 0
	};

	const updateProgress = () => onProgress(progress);
	updateProgress();

	const detected = await detect();
	progress.total = detected.length;
	updateProgress();

	for (const video of detected) {
		/**
		 * Web browsers don't really support multiple audio streams in one video, there are some experimental APIs
		 * that are very poorly supported (video.audioTracks is behind a flag in most browsers, and isn't really
		 * functional in Chrome and Firefox). To get around this we create separate video files, one for each
		 * audio stream present.
		 *
		 * The process is done in two steps. Re-encoding video to a different codec can take a long time, so it
		 * just re-encodes all of the streams at once to a temporary file, then subsequently creates files with
		 * one audio stream per video.
		 */

		const taskDetails = {
				startTime: Date.now(),
				videoName: video.videoName,
				videoPath: video.videoPath
			},
			destPath = path.dirname(video.videoPath)
				.replace('./videos/src', './videos/dest'),
			//check if audio/video streams have web friendly codecs, convert if needed
			needsAudioConversion = !video.audioStreams.every(stream => safeCodecs.audio.includes(stream.codec_name)),
			needsVideoConversion = !video.videoStreams.every(stream => safeCodecs.video.includes(stream.codec_name)),
			//'copy' codecs just leave the stream as-is, anything else will re-encode the stream and takes significantly more time
			//and processing power, instead of blanket converting everything we check first to see if it's needed
			vcodec = `-vcodec ${needsVideoConversion ? 'libx264' : 'copy'}`,
			//convert audio to aac with a constant bitrate for simpler playback syncing
			acodec = `-acodec ${needsAudioConversion ? 'aac' : 'copy'}`;

		if (needsAudioConversion) {
			progress.audioStreamsTranscoded += video.audioStreams.length;
		}
		else {
			progress.audioStreamsCopied += video.audioStreams.length;
		}

		//track some metadata, including names of individually extracted audio streams
		const metadata = {
			name: video.videoNameBase,
			videos: [],
			subtitles: []
		};

		//currently only care about one video stream until I have a good reason not to
		needsVideoConversion ? progress.videoStreamsTranscoded++ : progress.videoStreamsCopied++;

		const temporaryFullTranscodePath = `${path.join(destPath, video.videoNameBase)}-temporary.mp4`,
			quotedFullTranscodePath = `"${temporaryFullTranscodePath}"`,
			ffmpegVideoArgs = [
				`-i "${video.videoPath}"`,
				//select all video and audio streams, transcode them all for now, then
				//split them out into distinct videos per audio stream later
				`-map 0:v:0 ${vcodec}`, //probably don't need more than one video stream?
				`-map 0:a ${acodec}`,
				`-sn`, // don't copy subtitles, they'll be copied from the original file
				quotedFullTranscodePath
			];

		Object.assign(taskDetails, {
			needsAudioConversion,
			needsVideoConversion,
			processing: true,
			processed: false,
			// individual ffmpeg tasks to run: transcode, audio-stream specific mux, subtitles
			done: 0,
			total: 3
		});
		progress.tasks.push(taskDetails);
		updateProgress();

		//preserve the source file structure and output to a matching directory in dest/, but we need to make sure that path exists first
		await mkdirp(destPath);

		await runffmpeg(ffmpegVideoArgs);
		taskDetails.done++;
		updateProgress();

		/**
		 * From the fully transcoded file export separate mp4 files for each audio stream
		 */
		for (let i = 0; i < video.audioStreams.length; i++) {
			const audioStream = video.audioStreams[i],
				//if it's mp3 we leave it, anything not mp3 or aac gets converted to aac
				//so mp3 is the only case where it's anything but aac
				fileName = `${video.videoNameBase}-${i}.mp4`;

			metadata.videos.push({
				language: audioStream.tags.language,
				title: audioStream.tags.title,
				fileName
			});

			await runffmpeg([
				`-i ${quotedFullTranscodePath}`,
				//the full transcode already re-encoded to web safe codecs, just copy them
				`-map 0:v -c:v copy`,
				`-map 0:a:${i} -c:a copy`,
				`"${path.join(destPath, fileName)}"`
			]);
		}

		taskDetails.done++;
		updateProgress();

		for (let i = 0; i < video.subtitleStreams.length; i++) {
			const subtitleStream = video.subtitleStreams[i],
				extension = getSubtitleExtension(subtitleStream.codec_name);
			if (safeCodecs.subtitle.includes(subtitleStream.codec_name)) {
				const extractFilePath = `./temp/temp-extract.${extension}`;
				await runffmpeg([
					//don't prompt if we want to overwrite the file, it's a temp file so nothing worthwhile would be lost.
					//if somehow a transcode failed and this file still exists we'd otherwise just sit there and spin
					'-y',
					`-analyzeduration 50M -probesize 50M`,
					`-c:s ${subtitleStream.codec_name}`,
					`-i "${video.videoPath}"`,
					`-map 0:s:${i}`,
					extractFilePath
				]);

				metadata.subtitles.push({
					format: extension,
					language: subtitleStream.tags.language,
					title: subtitleStream.tags.title || subtitleStream.tags.language || `Subtitle Stream ${i + 1}`,
					content: (await fs.readFile(extractFilePath)).toString()
				});

				//delete the temporary file for extracting the subtitles, we save the full contents in metadata since it's just text
				await fs.unlink(extractFilePath);
				progress.subtitleTracksExtracted++;
			}
			else {
				progress.subtitleTracksSkipped++;
			}
			updateProgress();
		}

		//delete the temporary file, now that we've exported individual audio stream files
		await fs.unlink(`./${temporaryFullTranscodePath}`);

		taskDetails.done++;
		updateProgress();

		await fs.writeFile(
			path.join(destPath, `${video.videoNameBase}-metadata.json`),
			JSON.stringify(metadata, null, 4)
		)

		Object.assign(taskDetails, {
			endTime: Date.now(),
			processing: false,
			processed: true
		})
		progress.done++;
		updateProgress();
	}

	progress.endTime = Date.now();
	updateProgress();
	converting = false;
}

module.exports = {
	detect,
	tryConvert
};