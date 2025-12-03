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
			if (interaction.customId === "go_to_courselist") {
				const originalUser = interaction.message.interaction?.user?.id;

				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({
							content: "These controls aren't for you!",
							ephemeral: true
						});
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized button:', err?.message || err);
						return;
					}
				}

				const cmd = interaction.client.commands.get("course_list");
				return cmd.execute(interaction, true);
			}

			if (interaction.customId.startsWith("go_to_requisites")) {
				const originalUser = interaction.message.interaction?.user?.id;
				const [_, courseId] = interaction.customId.split(":");

				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({
							content: "These controls aren't for you!",
							ephemeral: true
						});
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized button:', err?.message || err);
						return;
					}
				}

				const cmd = interaction.client.commands.get("course_requisites");
				return cmd.execute(interaction, courseId, true);
			}

			if (interaction.customId.startsWith("go_to_corequisites")) {
				const originalUser = interaction.message.interaction?.user?.id;
				const [_, courseId] = interaction.customId.split(":");

				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({
							content: "These controls aren't for you!",
							ephemeral: true
						});
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized button:', err?.message || err);
						return;
					}
				}

				const cmd = interaction.client.commands.get("course_corequisites");
				return cmd.execute(interaction, courseId, true);
			}
			
			if (interaction.customId.startsWith("go_to_prerequisites")) {
				const originalUser = interaction.message.interaction?.user?.id;
				const [_, courseId] = interaction.customId.split(":");

				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({
							content: "These controls aren't for you!",
							ephemeral: true
						});
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized button:', err?.message || err);
						return;
					}
				}

				const cmd = interaction.client.commands.get("course_prerequisites");
				return cmd.execute(interaction, courseId, true);
			}

			if (interaction.customId === "go_to_degreelist") {
				const originalUser = interaction.message.interaction?.user?.id;

				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({
							content: "These controls aren't for you!",
							ephemeral: true
						});
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized button:', err?.message || err);
						return;
					}
				}

				const cmd = interaction.client.commands.get("degree_list");
				return cmd.execute(interaction, true);
			}

			if (interaction.customId.startsWith("go_to_degree_courses")) {
				const originalUser = interaction.message.interaction?.user?.id;
				const [_, degreeId] = interaction.customId.split(":");

				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({
							content: "These controls aren't for you!",
							ephemeral: true
						});
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized button:', err?.message || err);
						return;
					}
				}

				const cmd = interaction.client.commands.get("degree_courses");
				return cmd.execute(interaction, degreeId, true);
			}

			return;
		}

		// Handle select menu interactions
		if (interaction.isStringSelectMenu()) {
			if (interaction.customId === 'select_course') {
				const originalUser = interaction.message.interaction?.user?.id;
				if (originalUser && interaction.user.id !== originalUser) {
					try {
						return await interaction.reply({ content: "These controls aren't for you!", ephemeral: true });
					} catch (err) {
						console.debug('ignored interaction.reply error for unauthorized select:', err?.message || err);
						return;
					}
				}
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
