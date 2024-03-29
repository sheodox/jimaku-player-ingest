require('dotenv').config();
const express = require('express'),
	app = express(),
	http = require('http').createServer(app),
	io = require('socket.io')(http);

app.use('/video', require('./routes/video.js')(io));
app.use('/fontawesome', express.static('./node_modules/@fortawesome/fontawesome-free'));
app.get('/*', express.static('./static'));

http.listen(3600, () => {
	console.log('Jimaku Player Ingest server running');
});
