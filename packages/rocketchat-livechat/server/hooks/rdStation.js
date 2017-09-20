RocketChat.callbacks.add('livechat.saveInfo', (room) => {
	const postData = RocketChat.Livechat.getLivechatRoomGuestInfo(room);

	if (!postData.visitor.email) {
		return room;
	}

	const options = {
		headers: {
			'Content-Type': 'application/json'
		},
		data: {
			token_rdstation: '',
			identificador: 'rocketchat-livechat',
			client_id: postData.visitor._id,
			email: postData.visitor.email
		}
	};

	options.data.nome = postData.visitor.name || postData.visitor.username;
	options.data.telefone = postData.visitor.phone;

	const result = HTTP.call('POST', 'https://www.rdstation.com.br/api/1.3/conversions', options);

	console.log('result ->', result);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-rd-station-save-info');
