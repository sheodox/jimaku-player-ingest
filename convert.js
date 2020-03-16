const {promisify} = require('util'),
	fs = require('fs'),
	path = require('path'),
	child_process = require('child_process'),
	exec = promisify(child_process.exec),
	mkdirp = require('mkdirp'),
	ElapsedTimer = require('./elapsedTimer'),
	glob = promisify(require('glob'));

//ensure source and destination directories exist, even if the first run means they contain nothing, the directories will be set up
['./src', './dest'].forEach(dir => {
	try {
		fs.mkdirSync(dir);
	}catch(e) {}
});

async function convert() {
	//don't want to mix in new videos with the previously output stuff, plus without -y ffmpeg
	//will stall asking if files should be overwritten, but this doesn't use that.
	const destVideos = await glob('./dest/**/*.mp4');
	if (destVideos.length) {
		console.error(`dest has videos, clean it out first before running!`);
		return;
	}

	//cumulative stats for how long everything takes and what was needed
	const stats = {
			videos: 0,
			hasJapaneseAudio: 0,
			convertedAudio: 0,
			convertedVideo: 0
		},
		totalTimer = new ElapsedTimer();

	const videos = await glob(`./src/**/*.mkv`);
	// const videos = await glob(`./src/Ak*.mkv`);

	for (const videoPath of videos) {
		const fileName = path.basename(videoPath),
			destPath = path.dirname(videoPath).replace('./src', './dest');

		//collect information on the audio and video streams
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
			//check if audio/video streams have web friendly codecs, convert if needed
			needsAudioConversion = !['mp3', 'aac'].includes(audioCodec),
			needsVideoConversion = videoStreams[0].codec_name !== 'h264',
			//'copy' codecs just leave the stream as-is, anything else will re-encode the stream and takes significantly more time
			//and processing power, instead of blanket converting everything we check first to see if it's needed
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

		//preserve the source file structure and output to a matching directory in dest/, but we need to make sure that path exists first
		await mkdirp(destPath);
		const videoTimer = new ElapsedTimer();

		await new Promise((resolve, reject) => {
			console.log(`starting at ${new Date().toLocaleString()}`);
			const child = child_process.spawn(`ffmpeg`, [`-loglevel warning -stats -i "${videoPath}" ${jpStreamMap} -sn ${codecs} "${path.join(destPath, path.basename(fileName, '.mkv'))}.mp4"`], {shell: true});
			child.stdout.on('data', data => console.log(data.toString()));
			//ffmpeg logs progress information (including speed) to stderr, ignore it while it's processing or it's just a lot of unnecessary
			//logging, but save the last thing that was logged so we can log later, the progress logs include a speed factor comparing the
			//speed of the ffmpeg operation to the length of the source media, nice to know how fast or slow it's going so we log this once later
			let lastProgress = '';
			child.stderr.on('data', data => lastProgress = data.toString());
			child.on("close", code => {
				console.log(`time taken to process: ${videoTimer.getElapsed()} (finished at ${new Date().toLocaleString()})`);
				console.log(lastProgress);
				code === 0 ? resolve() : reject();
			})
		});
	}
	console.table(stats);
	console.log(`Total time: ${totalTimer.getElapsed()}`);
}
convert();