/*globals defaultUserLanguage, KonchatNotification */
import _ from 'underscore';
import s from 'underscore.string';
import toastr from 'toastr';

const notificationLabels = {
	all: 'All_messages',
	mentions: 'Mentions',
	nothing: 'Nothing'
};

function checkedSelected(property, value, defaultValue=undefined) {
	if (defaultValue && defaultValue.hash) {
		defaultValue = undefined;
	}
	return RocketChat.getUserPreference(Meteor.user(), property, defaultValue) === value;
}

Template.accountPreferences.helpers({
	showMergedChannels() {
		return ['category', 'unread'].includes(Template.instance().roomsListExhibitionMode.get()) ? '' : 'disabled';
	},
	audioAssets() {
		return (RocketChat.CustomSounds && RocketChat.CustomSounds.getList && RocketChat.CustomSounds.getList()) || [];
	},
	newMessageNotification() {
		return RocketChat.getUserPreference(Meteor.user(), 'newMessageNotification');
	},
	newRoomNotification() {
		return RocketChat.getUserPreference(Meteor.user(), 'newRoomNotification');
	},
	languages() {
		const languages = TAPi18n.getLanguages();

		const result = Object.keys(languages).map((key) => {
			const language = languages[key];
			return _.extend(language, { key });
		});

		return _.sortBy(result, 'key');
	},
	userLanguage(key) {
		const user = Meteor.user();
		let result = undefined;
		if (user.language) {
			result = user.language === key;
		} else if (defaultUserLanguage()) {
			result = defaultUserLanguage() === key;
		}
		return result;
	},
	checked(property, value, defaultValue=undefined) {
		return checkedSelected(property, value, defaultValue);
	},
	selected(property, value, defaultValue=undefined) {
		return checkedSelected(property, value, defaultValue);
	},
	highlights() {
		const userHighlights = RocketChat.getUserPreference(Meteor.user(), 'highlights');
		return userHighlights ? userHighlights.join(', ') : undefined;
	},
	desktopNotificationEnabled() {
		return KonchatNotification.notificationStatus.get() === 'granted' || (window.Notification && Notification.permission === 'granted');
	},
	desktopNotificationDisabled() {
		return KonchatNotification.notificationStatus.get() === 'denied' || (window.Notification && Notification.permission === 'denied');
	},
	desktopNotificationDuration() {
		const userPref = RocketChat.getUserPreference(Meteor.user(), 'desktopNotificationDuration', 'undefined');
		return userPref !== 'undefined' ? userPref : undefined;
	},
	defaultDesktopNotificationDuration() {
		return RocketChat.settings.get('Accounts_Default_User_Preferences_desktopNotificationDuration');
	},
	idleTimeLimit() {
		return RocketChat.getUserPreference(Meteor.user(), 'idleTimeLimit');
	},
	defaultIdleTimeLimit() {
		return RocketChat.settings.get('Accounts_Default_User_Preferences_idleTimeoutLimit');
	},
	defaultDesktopNotification() {
		return notificationLabels[RocketChat.settings.get('Accounts_Default_User_Preferences_desktopNotifications')];
	},
	defaultMobileNotification() {
		return notificationLabels[RocketChat.settings.get('Accounts_Default_User_Preferences_mobileNotifications')];
	},
	showRoles() {
		return RocketChat.settings.get('UI_DisplayRoles');
	},
	notificationsSoundVolume() {
		return RocketChat.getUserPreference(Meteor.user(), 'notificationsSoundVolume');
	}
});

Template.accountPreferences.onCreated(function() {
	const user = Meteor.user();
	const settingsTemplate = this.parentTemplate(3);

	if (settingsTemplate.child == null) {
		settingsTemplate.child = [];
	}

	settingsTemplate.child.push(this);

	this.roomsListExhibitionMode = new ReactiveVar(RocketChat.getUserPreference(user, 'roomsListExhibitionMode'));
	this.useEmojis = new ReactiveVar(RocketChat.getUserPreference(user, 'useEmojis'));

	let instance = this;

	this.autorun(() => {
		if (instance.useEmojis && instance.useEmojis.get()) {
			Tracker.afterFlush(() => $('#convertAsciiEmoji').show());
		} else {
			Tracker.afterFlush(() => $('#convertAsciiEmoji').hide());
		}
	});

	this.clearForm = function() {
		this.find('#language').value = localStorage.getItem('userLanguage');
	};

	this.shouldUpdateLocalStorageSetting = function(setting, newValue) {
		return localStorage.getItem(setting) !== newValue;
	};

	this.save = function() {
		instance = this;
		const data = {};

		data.newRoomNotification = $('select[name=newRoomNotification]').val();
		data.newMessageNotification = $('select[name=newMessageNotification]').val();
		data.useEmojis = $('input[name=useEmojis]:checked').val();
		data.convertAsciiEmoji = $('input[name=convertAsciiEmoji]:checked').val();
		data.saveMobileBandwidth = $('input[name=saveMobileBandwidth]:checked').val();
		data.collapseMediaByDefault = $('input[name=collapseMediaByDefault]:checked').val();
		data.viewMode = parseInt($('#viewMode').find('select').val());
		data.hideUsernames = $('#hideUsernames').find('input:checked').val();
		data.hideRoles = $('#hideRoles').find('input:checked').val();
		data.hideFlexTab = $('#hideFlexTab').find('input:checked').val();
		data.hideAvatars = $('#hideAvatars').find('input:checked').val();
		data.mergeChannels = $('#mergeChannels').find('input:checked').val();
		data.sendOnEnter = $('#sendOnEnter').find('select').val();
		data.roomsListExhibitionMode = $('select[name=roomsListExhibitionMode]').val();
		data.autoImageLoad = $('input[name=autoImageLoad]:checked').val();
		data.emailNotificationMode = $('select[name=emailNotificationMode]').val();
		data.desktopNotificationDuration = $('input[name=desktopNotificationDuration]').val();
		data.desktopNotifications = $('#desktopNotifications').find('select').val();
		data.mobileNotifications = $('#mobileNotifications').find('select').val();
		data.unreadAlert = $('#unreadAlert').find('input:checked').val();
		data.notificationsSoundVolume = parseInt($('#notificationsSoundVolume').val());
		data.roomCounterSidebar = $('#roomCounterSidebar').find('input:checked').val();
		data.highlights = _.compact(_.map($('[name=highlights]').val().split('\n'), function(e) {
			return s.trim(e);
		}));

		const selectedLanguage = $('#language').val();
		const enableAutoAway = $('#enableAutoAway').find('input:checked').val();
		const idleTimeLimit = parseInt($('input[name=idleTimeLimit]').val());

		data.enableAutoAway = enableAutoAway;
		data.idleTimeLimit = idleTimeLimit;

		let reload = false;

		// if highlights changed we need page reload
		const highlights = RocketChat.getUserPreference(Meteor.user(), 'highlights');
		if (highlights && highlights.join('\n') !== data.highlights.join('\n')) {
			reload = true;
		}

		if (this.shouldUpdateLocalStorageSetting('userLanguage', selectedLanguage)) {
			localStorage.setItem('userLanguage', selectedLanguage);
			data.language = selectedLanguage;
			reload = true;
		}

		if (this.shouldUpdateLocalStorageSetting('enableAutoAway', enableAutoAway)) {
			localStorage.setItem('enableAutoAway', enableAutoAway);
			reload = true;
		}

		if (this.shouldUpdateLocalStorageSetting('idleTimeLimit', idleTimeLimit)) {
			localStorage.setItem('idleTimeLimit', idleTimeLimit);
			reload = true;
		}

		Meteor.call('saveUserPreferences', data, function(error, results) {
			if (results) {
				toastr.success(t('Preferences_saved'));
				instance.clearForm();
				if (reload) {
					setTimeout(function() {
						Meteor._reload.reload();
					}, 1000);
				}
			}
			if (error) {
				return handleError(error);
			}
		});
	};
});

Template.accountPreferences.onRendered(function() {
	Tracker.afterFlush(function() {
		SideNav.setFlex('accountFlex');
		SideNav.openFlex();
	});
});

Template.accountPreferences.events({
	'click .submit button'(e, t) {
		t.save();
	},
	'change input[name=useEmojis]'(e, t) {
		t.useEmojis.set($(e.currentTarget).val() === '1');
	},
	'click .enable-notifications'() {
		KonchatNotification.getDesktopPermission();
	},
	'click .test-notifications'() {
		KonchatNotification.notify({
			duration: $('input[name=desktopNotificationDuration]').val(),
			payload: { sender: { username: 'rocket.cat' }
			},
			title: TAPi18n.__('Desktop_Notification_Test'),
			text: TAPi18n.__('This_is_a_desktop_notification')
		});
	},
	'change [name=roomsListExhibitionMode]'(e, instance) {
		const value = $(e.currentTarget).val();
		instance.roomsListExhibitionMode.set(value);
	},
	'change .audio'(e) {
		e.preventDefault();
		const audio = $(e.currentTarget).val();
		if (audio === 'none') {
			return;
		}
		if (audio) {
			const $audio = $(`audio#${ audio }`);
			return $audio && $audio[0] && $audio.play();
		}
	}
});
