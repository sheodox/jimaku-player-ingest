const MS = {
	second: 1000,
	minute: 60 * 1000,
	hour: 60 * 60 * 1000
};

class ElapsedTimer {
	constructor() {
		this.start = Date.now()
	}
	getElapsed() {
		const elapsedMs = Date.now() - this.start,
			hours = Math.floor(elapsedMs / MS.hour),
			hoursRemainder = elapsedMs % MS.hour,
			minutes = Math.floor(hoursRemainder / MS.minute),
			minutesRemainder = hoursRemainder % MS.minute,
			seconds = (minutesRemainder) / MS.second,
			pad = num => num.toFixed(0).padStart(2, '0');

		return `${(hours > 0 ? `${pad(hours)}:` : '')}${pad(minutes)}:${pad(seconds)}`;
	}
}

module.exports = ElapsedTimer;
