const {promisify} = require('util'),
	fs = require('fs').promises,
	path = require('path'),
	child_process = require('child_process'),
	exec = promisify(child_process.exec),
	mkdirp = require('mkdirp'),
	glob = promisify(require('glob')),
	{safeCodecs, isGoodVideoProfile, isGoodAudioProfile} = require("./codecs");

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

function removeExtension(fileName) {
	return path.basename(fileName, path.extname(fileName));
}

//ensure source and destination directories exist, even if the first run means they contain nothing, the directories will be set up
async function detect() {
	await mkdirp('./temp');
	await mkdirp('./videos/src');
	await mkdirp('./videos/dest');
	await mkdirp('./videos/src-done');

	const videos = await glob(`./videos/src/**/*.mkv`),
		detected = [];

	for (let i = 0; i < videos.length; i++) {
		const videoPath = videos[i],
			//collect information on the audio and video streams
			audioProbe = JSON.parse((await exec(`ffprobe -v error -show_streams -select_streams a "${videoPath}" -print_format json`)).stdout),
			videoProbe = JSON.parse((await exec(`ffprobe -v error -show_streams -select_streams v "${videoPath}" -print_format json`)).stdout),
			subtitleProbe = JSON.parse((await exec(`ffprobe -v error -show_streams -select_streams s "${videoPath}" -print_format json`)).stdout),
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
			videoNameBase: removeExtension(videoPath),
			videoPath,
			audioStreams,
			videoStreams,
			subtitleStreams
		});
	}

	console.log(`scan done! detected ${detected.length} video(s)`);
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

	if (process.env.EMPTY_DEST_BEFORE_TRANSCODE === '1') {
		await fs.rmdir('./videos/dest', {recursive: true});
		await fs.mkdir('./videos/dest');
	}
	else {
		//don't want to mix in new videos with the previously output stuff, plus without -y ffmpeg
		//will stall asking if files should be overwritten, but this doesn't use that.
		const destVideos = await glob('./videos/dest/**/*.mp4');
		if (destVideos.length) {
			converting = false;
			onError(new Error(`Transcode destination has videos, clean it out first before running!`));
			return;
		}
	}

	//now that we know we're actually going to start transcoding, notify the caller
	onStart();

	//this takes a long time, onProgress will emit occasional progress events to the browser,
	//so dont await this. the caller only cares if it started or not
	await convert(onProgress, onCriticalError)
		.then(() => {
			converting = false;
		})
		.catch((e) => {
			converting = false;
		})
}

async function convert(onProgress, onCriticalError) {
	//cumulative stats for how long everything takes and what was needed
	const progress = {
		done: 0,
		total: 1,
		failed: 0,
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
		const taskDetails = {
			startTime: Date.now(),
			videoName: video.videoName,
			videoPath: video.videoPath
		};

		Object.assign(taskDetails, {
			processing: true,
			processed: false,
			done: 0,
		});

		try {
			/**
			 * Web browsers don't really support multiple audio streams in one video, there are some experimental APIs
			 * that are very poorly supported (video.audioTracks is behind a flag in most browsers, and isn't really
			 * functional in Chrome and Firefox). To get around this we use Media Source Extensions and DASH.
			 */
			const destPath = path.dirname(video.videoPath)
					.replace('./videos/src', './videos/dest');

			const videoTranscodeFile = video.videoNameBase + '.mp4',
				videoTranscodePath = `${path.join(destPath, videoTranscodeFile)}`,
				quotedVideoTranscodePath = `"${videoTranscodePath}"`;

			//track some metadata, including names of individually extracted audio streams
			const metadata = {
				name: video.videoNameBase,
				video: `${video.videoNameBase}_dashinit.mp4`,
				audio: [],
				subtitles: []
			};

			//preserve the source file structure and output to a matching directory in dest/, but we need to make sure that path exists first
			await mkdirp(destPath);

			progress.tasks.push(taskDetails);
			//the individual steps are an array of async functions, this makes it easier to mentally separate the tasks that need
			//doing, and lets the transcode step progress be tracked automatically
			const steps = [
				//video transcode
				async () => {
					const goodProfile = isGoodVideoProfile(video.videoStreams[0]);
					//transcode the video
					await runffmpeg([
						`-i "${video.videoPath}"`,
						//select all video and audio streams, transcode them all for now, then
						//split them out into distinct videos per audio stream later
						`-map 0:v:0`, //probably don't need more than one video stream?
						//move some data to the beginning of the container, this apparently makes
						//streaming faster but probably doesn't matter with DASH, probably doesn't hurt
						'-movflags +faststart',
						//MSE is more picky with supported profiles than the browser normally is it seems,
						//so try and require that every thing supports a
						goodProfile ? '-c:v copy' : '-c:v libx264 -profile:v high -level:v 4.0 -pix_fmt yuv420p',
						//make sure we have key frames often
						'-x264opts "keyint=24:min-keyint=24:no-scenecut"',
						quotedVideoTranscodePath
					]);
					goodProfile ? progress.videoStreamsCopied++ : progress.videoStreamsTranscoded++;
				},
				//audio transcode
				async () => {
					/**
					 * From the original video transcode individual audio clips for each audio stream
					 */
					for (let i = 0; i < video.audioStreams.length; i++) {
						const audioStream = video.audioStreams[i],
							//if it's mp3 we leave it, anything not mp3 or aac gets converted to aac
							//so mp3 is the only case where it's anything but aac
							codec = audioStream.codec_name === 'mp3' ? 'mp3' : 'aac',
							fileNameBase = `${video.videoNameBase}-${i}`,
							fileName = `${fileNameBase}.${codec}`,
							dashFileName = `${fileNameBase}_dashinit.mp4`,
							goodProfile = isGoodAudioProfile(audioStream),
							audioPath = path.join(destPath, fileName);

						await runffmpeg([
							`-i "${video.videoPath}"`,
							`-map 0:a:${i}`,
							goodProfile ? '-c:a copy' : '-acodec aac',
							`"${audioPath}"`
						]);

						metadata.audio.push({
							language: audioStream.tags.language,
							title: audioStream.tags.title,
							codec,
							//used just until we dash the file
							intermediateFileName: fileName,
							fileName: dashFileName,
						});

						goodProfile ? progress.audioStreamsCopied++ : progress.audioStreamsTranscoded++;
						updateProgress();
					}
				},
				//dash
				async () => {
					const dashBaseArgs = [
						'MP4Box',
						'-dash 10000',
						'-frag 10000',
						'-rap',
						'-bs-switching no',
						'-segment-timeline'
					];

					function execDash(extraArgs) {
						return exec([
							...dashBaseArgs,
							...extraArgs
						].join(' '), {
							cwd: destPath
						});
					}

					//create an MPD file and dash the video so it can be streamed with MSE
					await execDash([
						`"${videoTranscodeFile}"#video`,
					]);
					//there is a new '[video name]_dash.mp4' file now that is going to be used, get rid of the original
					await fs.unlink(videoTranscodePath);

					//embed the MPD file in the metadata file
					const videoMPDFilePath = path.join(destPath, `${video.videoNameBase}_dash.mpd`);
					metadata.mpd = (await fs.readFile(videoMPDFilePath)).toString()
					await fs.unlink(videoMPDFilePath);

					//dash audio
					for (const audio of metadata.audio) {
						await execDash([
							`"${audio.intermediateFileName}"`,
						]);

						const mpdFilePath = path.join(destPath, `${removeExtension(audio.intermediateFileName)}_dash.mpd`);
						audio.mpd = (await fs.readFile(mpdFilePath)).toString()
						await fs.unlink(mpdFilePath);
						//now that we have the dashed audio file, we don't need the original or any reference to it
						//and can delete it to save storage space
						await fs.unlink(path.join(destPath, audio.intermediateFileName));
						audio.intermediateFileName = undefined;
					}
				},
				//subtitle extraction
				async () => {
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
						} else {
							progress.subtitleTracksSkipped++;
						}
					}
				}
			];

			//run each step in sequence, updating progress each time
			taskDetails.total = steps.length;
			updateProgress();
			for (const step of steps) {
				await step();
				taskDetails.done++;
				updateProgress();
			}

			await fs.writeFile(
				path.join(destPath, `${video.videoNameBase}-metadata.json`),
				JSON.stringify(metadata, null, 4)
			);

			Object.assign(taskDetails, {
				endTime: Date.now(),
				processing: false,
				processed: true
			});

            if (process.env.MOVE_WHEN_COMPLETE === '1') {
				const movePath = video.videoPath.replace('./videos/src', './videos/src-done');
				await mkdirp(path.dirname(movePath));
				await fs.rename(video.videoPath, movePath);
			}

			progress.done++;
			updateProgress();
		}
		catch(e) {
			taskDetails.failed = true;
			progress.failed++;
			onCriticalError(e);
			updateProgress();

			if (process.env.STOP_ON_FAILURE === '1') {
				throw e;
			}
		}
	}

	progress.endTime = Date.now();
	updateProgress();
	converting = false;
}

module.exports = {
	detect,
	tryConvert
};