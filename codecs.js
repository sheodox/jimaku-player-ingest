const safeCodecs = {
	audio: [
		{format: 'aac', profiles: ['lc']},
		{format: 'mp3'}
	],
	video: [
		{format: 'h264', profiles: ['high']}
	],
	//just subtitle formats supported by jimaku-player
	subtitle: ['ass', 'subrip', 'ssa', 'webvtt']
};

function findCodecForFormat(stream, codecs) {
	return codecs.find(({format}) => format === stream.codec_name.toLowerCase());
}
function isProfileGood(stream, codecs) {
	const codec = findCodecForFormat(stream, codecs);
	return codec && (!codec.profiles || codec.profiles.includes((stream.profile || '').toLowerCase()));
}

//all of these expect an ffprobe 'stream' metadata object
function isGoodAudioCodec(stream) {
	return !!findCodecForFormat(stream, safeCodecs.audio);
}
function isGoodAudioProfile(stream) {
	return isProfileGood(stream, safeCodecs.audio);
}
function isGoodVideoCodec(stream) {
	return !!findCodecForFormat(stream, safeCodecs.video);
}
function isGoodVideoProfile(stream) {
    return isProfileGood(stream, safeCodecs.video);
}

module.exports = {
	safeCodecs,
	isGoodVideoCodec,
	isGoodVideoProfile,
	isGoodAudioCodec,
	isGoodAudioProfile
};
