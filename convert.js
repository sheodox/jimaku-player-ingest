const {promisify} = require('util'),
	fs = require('fs'),
	path = require('path'),
	child_process = require('child_process'),
	exec = promisify(child_process.exec),
	mkdirp = require('mkdirp'),
	glob = promisify(require('glob'));

//ensure source and destination directories exist, even if the first run means they contain nothing, the directories will be set up
['./src', './dest'].forEach(dir => {
	try {
		fs.mkdirSync(dir);
	}catch(e) {}
});

async function convert() {
	const destVideos = await glob('./dest/**/*.mp4');
	if (destVideos.length) {
		console.error(`dest has videos, clean it out first before running!`);
		return;
	}

	const stats = {
		videos: 0,
		hasJapaneseAudio: 0,
		convertedAudio: 0,
		convertedVideo: 0
	};

	const videos = await glob(`./src/**/*.mkv`);
	// const videos = await glob(`./src/Ak*.mkv`);

	for (const videoPath of videos) {
		const fileName = path.basename(videoPath),
			destPath = path.dirname(videoPath).replace('./src', './dest');

		const audioProbeExec = await exec(`ffprobe -v error -show_streams -select_streams a "${videoPath}" -print_format json`),
			videoProbeExec = await exec(`ffprobe -v error -show_streams -select_streams v "${videoPath}" -print_format json`),
			audioStreams = JSON.parse(audioProbeExec.stdout).streams,
			videoStreams = JSON.parse(videoProbeExec.stdout).streams,
			jpStream = audioStreams.find(stream => {
				return stream.tags.language === 'jpn'
			}),
			//need to select only the japanese audio stream if it exists, TODO evaluate need for 'DISPOSITION:DUB=0' checking?
			hasJpStream = !!jpStream,
			jpStreamMap = hasJpStream ? '-map 0:m:language:jpn -map 0:v' : '',
			//if it's mp3 or aac we don't want to re-encode, but if it's something different just convert it
			audioCodec = (jpStream ? jpStream : audioStreams[0]).codec_name,
			needsAudioConversion = !['mp3', 'aac'].includes(audioCodec),
			needsVideoConversion = videoStreams[0].codec_name !== 'h264',
			vcodec = `-vcodec ${needsVideoConversion ? 'libx264' : 'copy'}`,
			acodec =  `-acodec ${needsAudioConversion ? 'aac' : 'copy'}`,
			codecs = `${vcodec} ${acodec}`;

		console.table({
			'File name': fileName,
			'Has Japanese audio': hasJpStream,
			'Audio codec': audioCodec,
			'Video codec': `${videoStreams[0].codec_name} - (${videoStreams[0].codec_long_name})`,
			'Needs audio conversion': needsAudioConversion,
			'Needs video conversion': needsVideoConversion
		});

		stats.videos++;
		if (needsAudioConversion) {
			stats.convertedAudio++;
		}
		if (needsVideoConversion) {
			stats.convertedVideo++;
		}
		if (hasJpStream) {
			stats.hasJapaneseAudio++;
		}

		await mkdirp(destPath);
		const start = Date.now();
		await new Promise((resolve, reject) => {
			const child = child_process.spawn(`ffmpeg`, [`-loglevel warning -stats -i "${videoPath}" ${jpStreamMap} -sn ${codecs} "${path.join(destPath, path.basename(fileName, '.mkv'))}.mp4"`], {shell: true});
			child.stdout.on('data', data => console.log(data.toString()));
			//ffmpeg logs progress information (including speed) to stderr
			let lastProgress = '';
			child.stderr.on('data', data => lastProgress = data.toString());
			child.on("close", code => {
				const elapsedMs = Date.now() - start,
					minutes = Math.floor(elapsedMs / 60000),
					seconds = (elapsedMs % 60000) / 1000,
					pad = num => num.toFixed(0).padStart(2, '0');

				console.log(`time taken to convert: ${pad(minutes)}:${pad(seconds)}`);
				console.log(lastProgress);
				code === 0 ? resolve() : reject();
			})
		});
	}
	console.table(stats);
}
convert();