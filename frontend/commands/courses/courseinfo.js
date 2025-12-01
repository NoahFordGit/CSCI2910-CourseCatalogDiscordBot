const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('courseinfo')
        .setDescription('Look up course information from the a Course ID (e.g., CSCI1250).')
        .addStringOption(option => 
            option.setName('courseid')
                .setDescription('Start typing a Course ID... (autocomplete only shows first 25 results)')
                .setAutocomplete(true)
                .setRequired(true)
        ),
    
    // Autocomplete handler
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();

        const FASTAPI_URL = `http://127.0.0.1:8000/courses/search?id=${encodeURIComponent(focused)}`;

        try {
            const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
            const courses = Array.isArray(response.data) ? response.data : [];

            const choices = courses.slice(0, 25).map(course => ({
                name: `${course.course_id}`,
                value: course.course_id
            }));
            
            await interaction.respond(choices);

        } catch (error) {
            await interaction.respond([]);
        }
    },

    // Execute handler
	async execute(interaction) {
        await interaction.deferReply();

        try {
            const courseId = interaction.options.getString('courseid');
            const FASTAPI_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}`;
            
            const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
            const course = response.data;

            const courseEmbed = new EmbedBuilder()
                .setColor(0xFFC72C)
                .setTitle(`Course Information for ${courseId}`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/en/thumb/3/36/ETSU_Bucs_logo.svg/1200px-ETSU_Bucs_logo.svg.png')
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}` });

            courseEmbed.addFields(
                { name: 'Title', value: course.title || 'N/A', inline: false },
                { name: 'Course ID', value: course.course_id || 'N/A', inline: true },
                { name: 'Credits', value: course.credits ? course.credits.toString() : 'N/A', inline: true },
                { name: 'Description', value: course.description || 'N/A', inline: false },
            );

            await interaction.editReply({ embeds: [courseEmbed] });

        } catch (error) {
            console.log('Error fetching course information:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Course Information')
                .setDescription(`Could not fetch course ID: **${courseId}**`);

            await interaction.editReply({ embeds: [errorEmbed] });
        }
	},
};