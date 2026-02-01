const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path')

async function getMojangData(pseudo) {
	try {
		const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${pseudo}`);
		if (response.status === 200) {
			return await response.json();
		}
		return null;
	} catch (error) {
		console.error("Erreur API Mojang:", error);
		return null;
	}
}

function addMember(minecraftName, username, displayName, parentName) {
	const filePath = './data/members.json';
	let data = [];

	if (fs.existsSync(filePath)) {
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		data = JSON.parse(fileContent);
	}

	const existingIndex = data.findIndex(m => m.username === username);

	const newEntry = {
		username: username,
		displayName: displayName,
		minecraft: minecraftName,
		parent: parentName,
		whitelisted: false
	};

	if (existingIndex === -1) {
		data.push(newEntry);
		console.log(`Add members: ${displayName} (${username})`)
	}

	fs.writeFileSync(filePath, JSON.stringify(data, null, 44));
}

function handleNameChange(targetUsername, newDisplayName, oldDisplayName) {
	const filePath = './data/members.json';
	if (!fs.existsSync(filePath)) return;

	let data = [];
	try {
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		if (!fileContent.trim()){
			console.log("members.json is empty");
			return;
		}
			
		data = JSON.parse(fileContent);
	} catch(e) { 
		console.error("Error while reading members.json for name changing:", e.message);
		return;
	}

	let modified = false;

	const playerIndex = data.findIndex(p => p.username === targetUsername);
	if (playerIndex !== -1) {
		if (data[playerIndex].displayName !== newDisplayName) {
			data[playerIndex].displayName = newDisplayName;
			modified = true;
			console.log(`Pseudo update for ${targetUsername} : ${newDisplayName}`);
		} 
	}

	if (oldDisplayName) {
		data.forEach(entry => {
			if (entry.parent === oldDisplayName) {
				entry.parent = newDisplayName;
				modified = true;
				console.log(`Parents updated : Parent of ${entry.discord_display} is now ${newDisplayName}`);
			}
		});
	}

	if (modified) {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
	}
}

module.exports = { getMojangData, addMember, handleNameChange };