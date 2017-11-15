/* globals fileUploadHandler, Handlebars, fileUpload */
/* exported fileUpload */
import _ from 'underscore';
import s from 'underscore.string';

function readAsDataURL(file, callback) {
	const reader = new FileReader();
	reader.onload = ev => callback(ev.target.result, file);

	return reader.readAsDataURL(file);
}

function getUploadPreview(file, callback) {
	// If greater then 10MB don't try and show a preview
	if (file.file.size > (10 * 1000000)) {
		return callback(file, null);
	} else if (file.file.type == null) {
		callback(file, null);
	} else if ((file.file.type.indexOf('audio') > -1) || (file.file.type.indexOf('video') > -1) || (file.file.type.indexOf('image') > -1)) {
		file.type = file.file.type.split('/')[0];

		return readAsDataURL(file.file, content => callback(file, content));
	} else {
		return callback(file, null);
	}
}

function formatBytes(bytes, decimals) {
	if (bytes === 0) {
		return '0 Bytes';
	}

	const k = 1000;
	const dm = (decimals + 1) || 3;

	const sizes = [
		'Bytes',
		'KB',
		'MB',
		'GB',
		'TB',
		'PB'
	];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${ parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) } ${ sizes[i] }`;
}

fileUpload = function(filesToUpload) {
	const roomId = Session.get('openedRoom');
	const files = [].concat(filesToUpload);

	function consume() {
		const file = files.pop();
		if ((file == null)) {
			swal.close();
			return;
		}

		if (!RocketChat.fileUploadIsValidContentType(file.file.type)) {
			swal({
				title: t('FileUpload_MediaType_NotAccepted'),
				text: file.file.type || `*.${ s.strRightBack(file.file.name, '.') }`,
				type: 'error',
				timer: 3000
			});
			return;
		}

		if (file.file.size === 0) {
			swal({
				title: t('FileUpload_File_Empty'),
				type: 'error',
				timer: 1000
			});
			return;
		}

		return getUploadPreview(file, function(file, preview) {

			consume();

			const record = {
				name:  file.name || file.file.name,
				size: file.file.size,
				type: file.file.type,
				rid: roomId,
				description: ''
			};

			const upload = fileUploadHandler('Uploads', record, file.file);

			let uploading = Session.get('uploading') || [];
			uploading.push({
				id: upload.id,
				name: upload.getFileName(),
				percentage: 0
			});

			Session.set('uploading', uploading);

			upload.onProgress = function(progress) {
				uploading = Session.get('uploading');

				const item = _.findWhere(uploading, {id: upload.id});
				if (item != null) {
					item.percentage = Math.round(progress * 100) || 0;
					return Session.set('uploading', uploading);
				}
			};

			upload.start(function(error, file, storage) {
				if (error) {
					let uploading = Session.get('uploading');
					if (!Array.isArray(uploading)) {
						uploading = [];
					}

					const item = _.findWhere(uploading, { id: upload.id });

					if (_.isObject(item)) {
						item.error = error.message;
						item.percentage = 0;
					} else {
						uploading.push({
							error: error.error,
							percentage: 0
						});
					}

					Session.set('uploading', uploading);
					return;
				}


				if (file) {
					Meteor.call('sendFileMessage', roomId, storage, file, () => {
						Meteor.setTimeout(() => {
							const uploading = Session.get('uploading');
							if (uploading !== null) {
								const item = _.findWhere(uploading, {
									id: upload.id
								});
								return Session.set('uploading', _.without(uploading, item));
							}
						}, 2000);
					});
				}
			});

			Tracker.autorun(function(c) {
				const cancel = Session.get(`uploading-cancel-${ upload.id }`);
				if (cancel) {
					let item;
					upload.stop();
					c.stop();

					uploading = Session.get('uploading');
					if (uploading != null) {
						item = _.findWhere(uploading, {id: upload.id});
						if (item != null) {
							item.percentage = 0;
						}
						Session.set('uploading', uploading);
					}

					return Meteor.setTimeout(function() {
						uploading = Session.get('uploading');
						if (uploading != null) {
							item = _.findWhere(uploading, {id: upload.id});
							return Session.set('uploading', _.without(uploading, item));
						}
					}, 1000);
				}
			});
		});
	}

	consume();
};
