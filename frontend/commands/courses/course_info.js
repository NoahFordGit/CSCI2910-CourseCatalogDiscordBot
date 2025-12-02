const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('course_info')
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
	async execute(interaction, courseID, fromButton = false) {
        try {
            const courseId = courseID || interaction.options.getString('courseid');
            const FASTAPI_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}`;
            const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
            const course = response.data;
            
            // Determine interaction type and make sure we don't double-defer/reply
            if (!fromButton) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            }
            
            // Embed
            const courseEmbed = new EmbedBuilder()
                .setColor(0xFFC72C)
                .setTitle(`Course Information for ${courseId}`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}` });

            courseEmbed.addFields(
                { name: 'Title', value: course.title || 'N/A', inline: false },
                { name: 'Course ID', value: course.course_id || 'N/A', inline: true },
                { name: 'Credits', value: course.credits ? course.credits.toString() : 'N/A', inline: true },
                { name: 'Description', value: course.description || 'N/A', inline: false },
            );

            // Button row
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('go_to_courselist')
                    .setLabel('See all courses')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`go_to_requisites:${courseId}`)
                    .setLabel('See all Requisite Courses')
                    .setStyle(ButtonStyle.Primary)
            );
            
            if (fromButton) {
                // Prefer a single interaction.update() when possible to both acknowledge and update the original message.
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        return await interaction.update({ embeds: [courseEmbed], components: [row] });
                    }

                    // If the interaction was already acknowledged, edit the original message directly.
                    if (interaction.message) {
                        await interaction.message.edit({ embeds: [courseEmbed], components: [row] });
                        return;
                    }

                    // As a safe fallback, attempt a followUp (ephemeral) so the user still sees the result.
                    return await interaction.followUp({ embeds: [courseEmbed], components: [row], ephemeral: true });
                } catch (err) {
                    // If update fails (unknown/expired interaction) try a direct message edit fallback.
                    if (interaction.message) {
                        try { await interaction.message.edit({ embeds: [courseEmbed], components: [row] }); return; } catch (e) {}
                    }
                    // Final fallback: try to reply or followUp however possible
                    try { if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate(); } catch (e) {}
                    try { return await interaction.followUp({ embeds: [courseEmbed], components: [row], ephemeral: true }); } catch (e) {}
                }
            } else {
                return await interaction.editReply({ embeds: [courseEmbed], components: [row], fetchReply: true });
            }

        } catch (error) {
            console.log('Error fetching course information:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Course Information')
                .setDescription(`Could not fetch course ID, please ensure it is valid.`);

            // Safe error handling for both command and component interactions
            if (fromButton) {
                // Try to update the message directly (best-effort) or send a follow-up
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.update({ embeds: [errorEmbed], components: [] });
                        return;
                    }
                } catch (err) {
                    // If update fails, try editing the message then fall back to followUp
                    if (interaction.message) {
                        try { await interaction.message.edit({ embeds: [errorEmbed], components: [] }); return; } catch (e) {}
                    }
                    try { await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }); return; } catch (e) {}
                }

                // If nothing worked, silence it (we already tried best-effort)
                return;
            }

            // For a normal slash invocation make sure we have deferred or replied before editing
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
	},
};