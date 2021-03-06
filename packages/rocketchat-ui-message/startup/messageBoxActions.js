/* globals fileUpload chatMessages AudioRecorder device popover modal */

import mime from 'mime-type/with-db';
import {VRecDialog} from 'meteor/rocketchat:ui-vrecord';

RocketChat.messageBox.actions.add('Create_new', 'Video_message', {
	id: 'video-message',
	icon: 'video',
	condition: () => (navigator.getUserMedia || navigator.webkitGetUserMedia) && RocketChat.settings.get('FileUpload_Enabled') && RocketChat.settings.get('Message_VideoRecorderEnabled') && (!RocketChat.settings.get('FileUpload_MediaTypeWhiteList') || RocketChat.settings.get('FileUpload_MediaTypeWhiteList').match(/video\/webm|video\/\*/i)),
	action({messageBox}) {
		return VRecDialog.opened ? VRecDialog.close() : VRecDialog.open(messageBox);
	}
});

RocketChat.messageBox.actions.add('Create_new', 'Audio_message', {
	id: 'audio-message',
	icon: 'mic',
	condition: () => (navigator.getUserMedia || navigator.webkitGetUserMedia || Meteor.isCordova) && RocketChat.settings.get('FileUpload_Enabled') && RocketChat.settings.get('Message_AudioRecorderEnabled') && (!RocketChat.settings.get('FileUpload_MediaTypeWhiteList') || RocketChat.settings.get('FileUpload_MediaTypeWhiteList').match(/audio\/wav|audio\/\*/i)),
	action({event, element}) {
		event.preventDefault();
		const icon = element.querySelector('.rc-icon');

		//init media under cordova
		if (Meteor.isCordova && !window.mediaRec) {
			//alert('under cordova');
			//const src = 'cdvfile://localhost/temporary/myrecording.m4a';
			const src = 'myrecording.m4a';
			window.mediaRec = new Media(src,
				function() {
					var path = '';

					//因为压缩版的media插件不支持cdvfile协议，所以要区别每个平台下实际的文件位置
					if (device.platform == 'iOS') {
						path = cordova.file.tempDirectory;
					} else if (device.platform == 'Android') {
						path = cordova.file.externalRootDirectory;
					}

					window.resolveLocalFileSystemURL(path + src, function(entry) {
						entry.file(function(file) {
							var reader = new FileReader();

							reader.onloadend = function() {
								var blob = new Blob([ new Uint8Array(this.result)], { type: 'audio/mp4'});
								fileUpload([
									{
										file: blob,
										type: 'audio/mp4',
										name: 'audio_record.m4a'
									}
								]);

								entry.remove(function() {
								}, function(error) {
									alert('temp audio file delete error' + JSON.stringify(error));
								});
							};
							reader.readAsArrayBuffer(file);



						});

					}, function(err) {
						alert('resolve localfile url error' + JSON.stringify(err));
					});

					window.mediaRec = null;
				},
				function(err) {
					alert('recorder error' + JSON.stringify(err));
				});
		}




		if (chatMessages[RocketChat.openedRoom].recording) {
			popover.close();
			icon.style.color = '';
			icon.classList.remove('pulse');

			if (Meteor.isCordova) {
				if (window.mediaRec) {
					window.mediaRec.stopRecord();
					window.mediaRec.release();
					//alert(JSON.stringify(window.mediaRec));
					//alert('录音成功,结束录音');
					//window.mediaRec.seekTo(0);
					//window.mediaRec.play();
				}
			} else {
				if (window.recorder) {
					window.recorder.stop();
					window.recorder.getMp3Blob(function(blob) {

						fileUpload([
							{
								file: blob,
								type: 'audio/mp3',
								name: 'audio_record.mp3'
							}
						]);
					});
					window.recorder = null;
				}
			}


			chatMessages[RocketChat.openedRoom].recording = false;


			return false;
		}

		chatMessages[RocketChat.openedRoom].recording = true;
		icon.classList.add('pulse');
		icon.style.color = 'red';

		if (Meteor.isCordova) {
			if (window.mediaRec) {
				window.mediaRec.startRecord();
			}
		} else {
			window.recorder = new MP3Recorder({
				bitRate: 64,
				debug: true
			});

			window.recorder.start(function() {

			}, function(error) {
				alert('window recorder failed' + JSON.stringify(error));
			});
		}
	}
});


RocketChat.messageBox.actions.add('Add_files_from', 'Computer', {
	id: 'file-upload',
	icon: 'computer',
	condition: () => RocketChat.settings.get('FileUpload_Enabled'),
	action({event}) {
		event.preventDefault();
		const $input = $(document.createElement('input'));
		$input.css('display', 'none');
		$input.attr({
			id: 'fileupload-input',
			type: 'file',
			multiple: 'multiple'
		});

		$(document.body).append($input);

		$input.one('change', function(e) {
			const filesToUpload = [...e.target.files].map(file => {
				Object.defineProperty(file, 'type', {
					value: mime.lookup(file.name)
				});
				return {
					file,
					name: file.name
				};
			});
			fileUpload(filesToUpload);
			$input.remove();
		});

		$input.click();

		// Simple hack for cordova aka codegueira
		if ((typeof device !== 'undefined' && device.platform && device.platform.toLocaleLowerCase() === 'ios') || navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
			$input.click();
		}
	}
});

RocketChat.messageBox.actions.add('Share', 'My_location', {
	id: 'share-location',
	icon: 'map-pin',
	condition: () => RocketChat.Geolocation.get() !== false,
	action({rid}) {
		const position = RocketChat.Geolocation.get();
		const latitude = position.coords.latitude;
		const longitude = position.coords.longitude;
		const text = `<div class="upload-preview"><div class="upload-preview-file" style="background-size: cover; box-shadow: 0 0 0px 1px #dfdfdf; border-radius: 2px; height: 250px; width:100%; max-width: 500px; background-image:url(https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=500x250&markers=color:gray%7Clabel:%7C${ latitude },${ longitude }&key=${ RocketChat.settings.get('MapView_GMapsAPIKey') })" ></div></div>`;

		modal.open({
			title: t('Share_Location_Title'),
			text,
			showCancelButton: true,
			closeOnConfirm: true,
			closeOnCancel: true,
			html: true
		}, function(isConfirm) {
			if (isConfirm !== true) {
				return;
			}
			Meteor.call('sendMessage', {
				_id: Random.id(),
				rid,
				msg: '',
				location: {
					type: 'Point',
					coordinates: [longitude, latitude]
				}
			});
		});
	}
});
