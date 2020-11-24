const {detect, tryConvert} = require("../convert"),
	{Router} = require('express'),
	router = Router();

module.exports = (io) => {
	let detected,
		lastProgress,
		errors = [],
		criticalErrors = []

	function errorToToastArguments(title, e) {
		return {
			title,
			message: e.message,
			technicalDetails: e.stack
		}
	}

	let converting = false,
		detectPromise;

	router.get('/detect', async (req, res) => {
		// don't want to re-scan while transcoding, we should already know all that we're going to know
		if (converting && req.query.force) {
			res.status(409); //conflict
			res.json(detected);
			return;
		}
		if (!detected || req.query.force) {
			//if a detect request was already made, just reuse that instead of starting a second concurrent one
			if (!detectPromise) {
				console.log('scanning videos');
				detectPromise = detect();
			}
			detected = await detectPromise;
			detectPromise = null;
		}
		res.json(detected);
	});

	router.get('/transcode', async (req, res) => {
		function onStart() {
			converting = true;
			errors = [];
			criticalErrors = [];
			transcodePromise.finally(() => {
				converting = false;
				console.log('transcoding done!');
			})
		}

		function onProgress(progress) {
			io.emit('progress', progress);
			lastProgress = progress;
		}

		function onError(e) {
			console.log(e);
			errors.push(e);
			io.emit('error', errorToToastArguments('Error!', e));
		}

		function onCriticalError(e) {
			console.log(e);
			criticalErrors.push(e);
			io.emit('criticalError', errorToToastArguments('Critical Error!', e));
		}

		const transcodePromise = tryConvert(onStart, onProgress, onError, onCriticalError);

		res.send();
	});

	//toast all the errors they might have missed
	io.on('connection', socket => {
		socket.emit('progress', lastProgress);
		for (const error of errors) {
			socket.emit('error', errorToToastArguments('Error!', error));
		}
		for (const error of criticalErrors) {
			socket.emit('criticalError', errorToToastArguments('Critical Error!', error));
		}
	})

	return router;
}