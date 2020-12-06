# Jimaku Player Ingest

This is a project to transcode video files and generate manifest files for the local 
streaming video player in [Jimaku Player](https://github.com/sheodox/jimaku-player).

## Requirements

* [`ffmpeg/ffprobe`](https://ffmpeg.org/) - for video transcoding and subtitle extraction
* [`mediainfo`](https://mediaarea.net/en/MediaInfo) - for backup subtitle type detection. Sometimes `ffprobe` can't correctly identify subtitle types.
* [`gpac`](https://gpac.wp.imt.fr/) - for `MP4Box` which is used to prepare videos for streaming and generate the required [MPD file](https://en.wikipedia.org/wiki/Dynamic_Adaptive_Streaming_over_HTTP#Overview) (you might need to install from source instead of installing from your
 distribution's package manager repository version. As of November 2020 Ubuntu's version in APT
  is several years old and has issues that will cause issue generating the MPD file).