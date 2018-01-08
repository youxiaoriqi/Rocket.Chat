(function(window){

  var WORKER_PATH = 'recorderWorker.js';
  var encoderWorker = new Worker('newMp3Worker.js');

  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    var numChannels = config.numChannels || 2;
    this.context = source.context;
    this.node = (this.context.createScriptProcessor ||
                 this.context.createJavaScriptNode).call(this.context,
                 bufferLen, numChannels, numChannels);
    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: numChannels
      }
    });
    var recording = false,
      currCallback;

    this.node.onaudioprocess = function(e){
      if (!recording) return;
      var buffer = [];
      for (var channel = 0; channel < numChannels; channel++){
          buffer.push(e.inputBuffer.getChannelData(channel));
      }
      worker.postMessage({
        command: 'record',
        buffer: buffer
      });
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

    this.getBuffer = function(cb) {
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffer' })
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    worker.onmessage = function(e){
      var blob = e.data;
	  console.log("the blob " +  blob + " " + blob.size + " " + blob.type);

	  var arrayBuffer;
	  var fileReader = new FileReader();

	  fileReader.onload = function(e){

		console.log("Converting to Mp3");

 /*   encoderWorker.postMessage({ cmd: 'init', config:{
			channels:1,
			samplerate: data.sampleRate,
			bitrate: data.bitsPerSample
        }});
        */

        encoderWorker.postMessage({
          cmd: 'init',
          config: {}
        });


		encoderWorker.postMessage({ cmd: 'encode', rawInput: e.target.result });
        encoderWorker.postMessage({ cmd: 'finish'});

        encoderWorker.onmessage = function(e) {
            if (e.data.cmd == 'end') {

				console.log("Done converting to Mp3");

				//var audio = new Audio();
				//audio.src = 'data:audio/mp3;base64,'+encode64(e.data.buf);
				//audio.play();

				//console.log ("The Mp3 data " + e.data.buf.length);
				//console.log(e.data.buf);

				var mp3Blob = new Blob(e.data.buf, {type: 'audio/mp3'});
				//uploadAudio(mp3Blob);

						return fileUpload([
								{
									file: mp3Blob,
									type: 'audio/mp3',
									name: `${ TAPi18n.__('Audio record') }.mp3`
								}
							]);


            }
        };
	  };

	  fileReader.readAsArrayBuffer(blob);

      currCallback(blob);
    }


	function encode64(buffer) {
		var binary = '',
			bytes = new Uint8Array( buffer ),
			len = bytes.byteLength;

		for (var i = 0; i < len; i++) {
			binary += String.fromCharCode( bytes[ i ] );
		}
		return window.btoa( binary );
	}


    source.connect(this.node);
    this.node.connect(this.context.destination);    //this should not be necessary
  };

  Recorder.forceDownload = function(blob, filename){
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    var click = document.createEvent("Event");
    click.initEvent("click", true, true);
    link.dispatchEvent(click);
  }

  window.Recorder = Recorder;

})(window);
