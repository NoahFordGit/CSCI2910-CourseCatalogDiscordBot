const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('apiembedtest')
        .setDescription('Replies with Pong!'),

	async execute(interaction) {
        const FASTAPI_URL = 'http://127.0.0.1:8000/courses/search?title=Intro';
        const response = await axios.get(FASTAPI_URL);
        const courses = response.data;

        if (!Array.isArray(courses) || courses.length === 0) {
			return interaction.reply('No courses found.');
		}

        const embed = new EmbedBuilder()
            .setColor(0xFFC72C)
            .setTitle('API Embed Test')
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        courses.forEach(course => {
            embed.addFields({
                name: course.title || 'No Title',
                value: `Course ID: ${course.course_id}`,
                inline: false,
            });
        })

        await interaction.reply({ embeds: [embed] });
	},
};