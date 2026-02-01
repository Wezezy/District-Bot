const { Rcon } = require("rcon-client");
const fs = require('fs');
const mcStatus = require('mc-server-status');
const config = require('./config.json');


async function runWhitelistCommand(mcPseudo) {
	try {
		const rcon = await Rcon.connect({
			host: config.RCON_HOST,
			port: config.RCON_PORT,
			password: config.RCON_PASSWORD,
			timeout: 5000
		});

		console.log(`RCON connected. Adding ${mcPseudo}...`);
		const response = await rcon.send(`whitelist add ${mcPseudo}`);
		await rcon.end();
		return { success: true, message: response };
	} catch (error) {
		console.error("Rcon error : Server probably off.");
		return { success: false, error: error.message };
	}
}

async function isServerOnline() {
	try {
		const status = await mcStatus.getStatus(config.RCON_HOST, config.MC_PORT || 25565);
		return !!status;
	} catch (error) {
		return false;
	}
}

async function syncWhitelist() {
	
	const filePath = './data/members.json';
	if (!fs.existsSync(filePath)) return;

	let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
	const pending = data.filter(entry => entry.whitelisted === false);

	if (pending.length === 0) return;

	console.log(`${pending.length} players waiting...`);

	for (let entry of pending) {
		const result = await runWhitelistCommand(entry.minecraft);
		if (result.success){
			entry.whitelisted = true;
			console.log(`${entry.minecraft} added to whitelist.`);
		} else {
			console.error(`Error while adding ${entry.minecraft}.`);
			break;
		}
	}

	fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
}

module.exports = {runWhitelistCommand, syncWhitelist, isServerOnline};