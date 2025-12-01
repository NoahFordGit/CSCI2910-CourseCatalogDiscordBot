const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('embedtest')
        .setDescription('Replies with Pong!'),

	async execute(interaction) {
		// Create the embed instance
        const pingEmbed = new EmbedBuilder()
            .setColor(0x00A0E3) // A nice blue color
            .setTitle('🏓 Pong!')
            .setDescription('**Latency Check Complete**')
            .addFields(
                { 
                    name: 'API Latency', 
                    value: `${interaction.client.ws.ping}ms`, 
                    inline: true 
                },
                { 
                    name: 'Command Latency', 
                    value: `${Date.now() - interaction.createdTimestamp}ms`, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        // Reply to the interaction with the embed
        await interaction.reply({ embeds: [pingEmbed] });
	},
};