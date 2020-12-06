# Jimaku Player Ingest

This is a project to transcode video files and generate manifest files for the local 
streaming video player in [Jimaku Player](https://github.com/sheodox/jimaku-player).

## Requirements

* [`ffmpeg/ffprobe`](https://ffmpeg.org/) - for video transcoding and subtitle extraction
* [`mediainfo`](https://mediaarea.net/en/MediaInfo) - for backup subtitle type detection. Sometimes `ffprobe` can't correctly identify subtitle types.
* [`gpac`](https://gpac.wp.imt.fr/) - for `MP4Box` which is used to prepare videos for streaming and generate the required [MPD file](https://en.wikipedia.org/wiki/Dynamic_Adaptive_Streaming_over_HTTP#Overview) (you might need to install from source instead of installing from your
 distribution's package manager repository version. As of November 2020 Ubuntu's version in APT
  is several years old and has issues that will cause issue generating the MPD file).
 * [`nodejs`](https://nodejs.org/en/) - for running this project

## Install

Install all programs listed above, then in a terminal window in this directory, run the following commands:

1. `npm install`
1. `npm run build`
1. `npm start`
  
## Usage

1. Copy `.mkv` video files to a `videos/src` folder within the clone of this repository.
1. [Navigate to the ingest site](http://localhost:3600)
1. Hit the `Convert` button
1. When everything is done, copy everything in `videos/dest` to Jimaku Player's `videos` directory

The codecs and profiles are color coded signaling how fast the conversion will be.
* green - the codec or profile is a known web-safe codec, conversion will be fast because it doesn't have to do much but changing the container.
* yellow - the codec or profile isn't a web-safe codec, it will take a considerably longer amount of time to convert because it will need to transcode.
* red - (only subtitles) this codec isn't supported by Jimaku Player and will be ignored. This is often the case for image based subtitle formats.