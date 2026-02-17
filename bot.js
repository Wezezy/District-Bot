const {getMojangData, addMember, handleNameChange} = require('./dataHandler.js');
const { syncWhitelist, isServerOnline } = require('./whitelistHandler.js');
const config = require('./config.json');
const path = require('path');
const fs = require('fs');

const { 
	Client, 
	GatewayIntentBits, 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ModalBuilder, 
	TextInputBuilder, 
	TextInputStyle,
	EmbedBuilder
} = require('discord.js');

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});


client.login(config.TOKEN);

function checkFiles() {
    const dirPath = path.join(__dirname, 'data');
    const membersPath = path.join(dirPath, 'members.json');
    const relationsPath = path.join(dirPath, 'relations.json'); // Added this definition

    if (!fs.existsSync(dirPath)) {
        console.log("Folder 'data' not found. Creating folder 'data'.");
        fs.mkdirSync(dirPath);
    }

    if (!fs.existsSync(membersPath)) {
        console.log("File 'members.json' not found. Creating file 'members.json'.");
        fs.writeFileSync(membersPath, '[]', 'utf-8');
    }

    // This was causing the crash!
    if (!fs.existsSync(relationsPath)) {
        console.log("File 'relations.json' not found. Creating file 'relations.json'.");
        fs.writeFileSync(relationsPath, '[]', 'utf-8');
    }
}

client.once('clientReady', async () => {
	console.log(`District bot ready: ${client.user.tag}`);

	checkFiles();

	for (const guild of client.guilds.cache.values()) {
		try {
			await guild.members.fetch();
			console.log(`Cache loaded for server : ${guild.name} (${guild.members.cache.size} membres)`);
		} catch ( error ) {
			console.error(`Error loading members for ${guild.name}:`, error);
		}
	}

	setInterval(async () => {
		const online = await isServerOnline();

		if (online) {
			console.log("Server is online.");
			await syncWhitelist();
		}
	}, 5 * 60 * 1000);
});

client.on('guildMemberAdd', async (member) => {
	const roleArrived = member.guild.roles.cache.get(config.ROLE_ARRIVED);

	if (roleArrived) {
		try {
			await member.roles.add(roleArrived);
			console.log(`${roleArrived.name} role given to ${member.user.tag}`);
		} catch (error) {
			console.error(`Error giving ${roleArrived.name} role to ${member.user.tag}`);
		}
	} else {
		console.warn("Warning : Role ID ROLE_ARRIVED in config.json not found on this server.");
	}
});

client.on('messageCreate', async (message) => {
	if (message.content === '!setup_register' && message.member.permissions.has('Administrator')) {
		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('btn_register')
					.setLabel('S\'enregistrer')
					.setStyle(ButtonStyle.Primary),
			);

		await message.channel.send({
			content: 'Bienvenue! Clique sur le bouton pour t\'enregistrer et pouvoir accéder au serveur.',
			components: [row]
		});
	}
});

client.on('interactionCreate', async (interaction) => {
	if (interaction.isButton() && interaction.customId === 'btn_register') {
		const modal = new ModalBuilder()
			.setCustomId('modal_register')
			.setTitle('Enregistrement');

		const mcInput = new TextInputBuilder()
			.setCustomId('minecraft_pseudo')
			.setLabel("Ton pseudo Minecraft pour la whitelist")
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Ex: Rayqua29000')
			.setRequired(true);

		const parentInput = new TextInputBuilder()
			.setCustomId('parent_pseudo')
			.setLabel("Par qui as tu connus le serveur ? (Pseudo)")
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Ex: Rayqua')
			.setRequired(true);

		modal.addComponents(
			new ActionRowBuilder().addComponents(mcInput),
			new ActionRowBuilder().addComponents(parentInput)
		);

		await interaction.showModal(modal);
	}

	if (interaction.isModalSubmit() && interaction.customId === 'modal_register') {
		await interaction.deferReply({ ephemeral: true });

		const minecraftPseudo = interaction.fields.getTextInputValue('minecraft_pseudo');
		const parentPseudo = interaction.fields.getTextInputValue('parent_pseudo');
		const username = interaction.user.username;
		const displayName = interaction.member.displayName;

		const mojangData = await getMojangData(minecraftPseudo);
		if (!mojangData) {
			return await interaction.editReply({
				content: 'Le compte Minecraft n\'existe pas. Vérifie l\'orthographe. DM Rayqua si tu n\'y arrive pas.',
				ephemeral: true
			})
		}

		const validMCName = mojangData.name;
		const pythonPath = path.join(__dirname, 'venv', 'bin', 'python3');

		addMember(validMCName, username, displayName, parentPseudo);
		
		const { exec } = require('child_process');
		exec(`${pythonPath} -u pseudo_cleaner.py`, { cwd: path.join(__dirname, 'script'), shell: true }, (err, stdout, stderr) => {

			if (stdout) {
				console.log(`[Cleaner info]:\n${stdout}`);
			}
			if (stderr) {
				console.log(`[Cleaner Stderr]:\n${stderr}`);
			}
			if (err) return console.error("Cleaner error:", err);
			
			console.log("Pseudos cleaned, graph generating...");
			
			exec(`${pythonPath} graph_generator.py`, { cwd: path.join(__dirname, 'script') }, (err) => {
				if (err) return console.error("Graph error:", err);
				console.log("Graph udpated !");
			});
		});

		const online = await isServerOnline();
		if (online){
			await syncWhitelist(validMCName);
		}
	
		const member = interaction.member;

		const roleArrived = member.guild.roles.cache.get(config.ROLE_ARRIVED);
		const roleRegistered = member.guild.roles.cache.get(config.ROLE_REGISTERED);
		
		try {
			if (roleArrived && member.roles.cache.has(config.ROLE_ARRIVED)){
				await member.roles.remove(roleArrived);
			}

			if (roleRegistered) {
				await member.roles.add(roleRegistered);
				console.log(`${member.user.tag} role udpated.`);
			}
		} catch (error) {
			console.log(`Error while updating role: `, error);
		}

		const logChannel = client.channels.cache.get(config.LOG_CHANNEL_ID);

		if (logChannel) {
			const logEmbed = new EmbedBuilder()
				.setColor(0x00FF00)
				.setTitle('New registration!')
				.addFields(
					{name: "Name", value: `${displayName}`, inline: true},
					{name: "Minecraft Pseudo", value: `\`${validMCName}\``, inline: true},
					{name: "Invited by", value: `\`${parentPseudo}\``, inline: true}
				)
				.setTimestamp()
				.setFooter({ text: 'District Bot'});
			logChannel.send({ embeds: [logEmbed] });
		} else {
			console.warn("Warning : Can't find logs channel (Check LOG_CHANNEL_ID).")
		}

		await interaction.editReply({ 
			content: `Enregistrement validée! Si tu vois encore ce channel DM Rayqua.`,
			ephemeral: true 
		});
		console.log("Interaction ending");
	}
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
	if (oldMember.displayName !== newMember.displayName) {
		console.log(`DETECTION : ${oldMember.displayName} is now ${newMember.displayName}`);
		handleNameChange(newMember.user.username, newMember.displayName, oldMember.displayName);
	}
});
