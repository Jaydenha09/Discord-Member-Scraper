const readline = require('readline-sync');
const WebSocket = require('ws');
const fs = require('fs');

const token = readline.question('Enter Token: ').replaceAll(' ', '');
const serverId = readline.question('Enter server ID: ').replaceAll(' ', '');
const channelId = readline.question('Enter channel ID: ').replaceAll(' ', '');

const users = fs.existsSync('users.txt') ? fs.readFileSync('users.txt', 'utf-8').replaceAll(/\r/g, '').split('\n') : [];

function request(range) {}

function saveUsers() {
	fs.writeFileSync('users.txt', users.join('\n'));
}

function connect() {
	const ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');

	let seq = 0;
	let startedHB = false;
	let index = 0;

	function send(data) {
		ws.send(JSON.stringify(data));
	}

	function reqMembers() {
		const channelsObj = {};

		channelsObj[channelId] = [
			[index, index + 99],
			[index + 100, index + 199],
		];
		send({
			op: 14,
			d: {
				guild_id: serverId,
				channels: channelsObj,
			},
		});

		index += 100;
	}

	ws.on('open', () => {
		send({
			op: 2,
			d: {
				token: token,
				capabilities: 1021,
				properties: {
					os: 'Windows',
					browser: 'Chrome',
					device: '',
					system_locale: 'en-US',
					browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
					browser_version: '106.0.0.0',
					os_version: '10',
					referrer: 'https://www.google.com/',
					referring_domain: 'www.google.com',
					search_engine: 'google',
					referrer_current: '',
					referring_domain_current: '',
					release_channel: 'stable',
					client_build_number: 150748,
					client_event_source: null,
				},
				presence: { status: 'online', since: 0, activities: [], afk: false },
				compress: false,
				client_state: { guild_hashes: {}, highest_last_message_id: '0', read_state_version: 0, user_guild_settings_version: -1, user_settings_version: -1, private_channels_version: '0' },
			},
		});
	});

	ws.on('error', (e) => {
		console.error(e);
	});

	ws.on('close', () => {
		connect();
	});

	ws.on('message', (msg) => {
		const obj = JSON.parse(msg.toString());

		if (obj.s) {
			seq = obj.s;
		}

		if (obj.t == 'READY') {
			reqMembers();
		} else if (obj.t == 'GUILD_MEMBER_LIST_UPDATE') {
			let found = 0;

			const ops = obj.d.ops;
			for (const op of ops) {
				const items = op.items;
				try {
					for (const item of items) {
						const userId = item?.member?.user?.id;
						if (!userId) {
							continue;
						}

						found++;
						if (!users.includes(userId)) {
							users.push(userId);
						}
					}
				} catch {
					console.log(items);
				}

				saveUsers();
			}

			if (found == 0) {
				saveUsers();
				console.log('Retrieved all ' + users.length + ' members.');
				process.exit();
			} else {
				console.log('Retrieved ' + found + ' members - still going');
				reqMembers();
			}
		} else if (obj.op == 10) {
			if (!startedHB) {
				startedHB = true;
				const interval = obj.d.heartbeat_interval;
				(async () => {
					while (ws.readyState == ws.OPEN) {
						send({
							op: 1,
							d: seq,
						});

						await new Promise((resolve) => setTimeout(resolve, interval));
					}
				})();
			}
		} else {
			console.log(obj.op + ': ' + obj.t);
		}
	});
}

connect();
