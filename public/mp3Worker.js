importScripts('lame.min.js');

var mp3codec;

self.onmessage = function(e) {
	switch (e.data.cmd) {
		case 'init':
			if (!e.data.config) {
				e.data.config = { };
			}
			mp3codec = new lamejs.Mp3Encoder(e.data.config.channels || 2,e.data.config.samplerate || 44100,e.data.config.bitrate || 128);

			break;
		case 'encode':
			var mp3data = mp3codec.encodeBuffer( e.data.buf);
			self.postMessage({cmd: 'data', buf: mp3data.data});
			break;
		case 'finish':
			var mp3data = mp3codec.flush();
			self.postMessage({cmd: 'end', buf: mp3data.data});
			mp3codec.close();
			mp3codec = null;
			break;
	}
};
