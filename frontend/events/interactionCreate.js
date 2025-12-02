const { Events, MessageFlags } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {

		// Handle autocomplete interactions
		if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);
			if (!command || !command.autocomplete) return;

			try {
				await command.autocomplete(interaction);
			} catch (error) {
				console.error('Autocomplete error:', error);
			}
			return;
		}

		// Handle button interactions
		if (interaction.isButton()) {
			const originalUser = interaction.message.interaction?.user?.id;

			if (originalUser && interaction.user.id !== originalUser) {
				return interaction.reply({
					content: "These controls aren't for you!",
					ephemeral: true
				});
			}

            if (interaction.customId === "go_to_courselist") {
				const cmd = interaction.client.commands.get("courselist");
				return cmd.execute(interaction, true);
			}

            return;
        }

		// Handle select menu interactions
		if (interaction.isStringSelectMenu()) {

			const originalUser = interaction.message.interaction?.user?.id;

			if (originalUser && interaction.user.id !== originalUser) {
				return interaction.reply({
					content: "These controls aren't for you!",
					ephemeral: true
				});
			}

				return;
		}

		// Handle chat input commands
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			} else {
				await interaction.reply({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};
