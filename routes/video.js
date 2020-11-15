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

	router.get('/detect', async (req, res) => {
		if (!detected) {
			detected = await detect()
		}
		res.json(detected);
	});

	router.get('/transcode', async (req, res) => {
		function onStart() {
			errors = [];
			criticalErrors = [];
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

		tryConvert(onStart, onProgress, onError, onCriticalError);

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