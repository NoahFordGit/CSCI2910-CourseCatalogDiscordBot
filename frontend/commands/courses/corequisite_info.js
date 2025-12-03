const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const autocompleteCourseId = require('../../utils/autocompleteCourseId');
const collectorManager = require('../../utils/collectorManager');
const courseList = require('./course_list');

const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('course_corequisites')
        .setDescription('Look up all corequisite courses from a Course ID (e.g., CSCI1250).')
        .addStringOption(option => 
            option.setName('courseid')
                .setDescription('Start typing a Course ID... (autocomplete only shows first 25 results)')
                .setAutocomplete(true)
                .setRequired(true)
        ),
    
    // Autocomplete handler
    autocomplete: autocompleteCourseId,

    // Execute handler
    async execute(interaction, courseID, fromButton = false) {
        try {
            const courseId = courseID || interaction.options.getString('courseid');
            const FASTAPI_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}/corequisites`;
            const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
            const coreqs = response.data;

            // Determine interaction type and make sure we don't double-defer/reply
            if (!fromButton) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            }
            
            let page = 0;
            let maxPage = coreqs.length - 1;


            // Embed generator
            const generateEmbed = (page) => {
                const c = coreqs[page];
                return new EmbedBuilder()
                    .setColor(0xFFC72C)
                    .setTitle(`Corequisite (${page + 1} of ${coreqs.length})`)
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                    .addFields(
                        { name: 'Title', value: c.title || 'N/A', inline: false },
                        { name: 'Course ID', value: `\`${c.course_id}\`` || 'N/A', inline: true },
                        { name: 'Credits', value: c.credits ? c.credits.toString() : 'N/A', inline: true },
                        { name: 'Description', value: c.description || 'N/A', inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Parent Course: ${courseId}` })
            };

            const coreqEmbed = generateEmbed(page);

            // Button generator (used for initial render and updates)
            const generateButtons = (page) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('go_to_courselist')
                        .setLabel('See all Courses')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('⬅️ Prev')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === maxPage),
                );
            };

            // initial button row
            const row = generateButtons(page);
            
            let sentMessage;
            if (fromButton) {
                await interaction.update({ embeds: [coreqEmbed], components: [row] });
                // interaction.message should be the original message; fallback to fetchReply()
                sentMessage = interaction.message ?? await interaction.fetchReply();
            } else {
                sentMessage = await interaction.editReply({ embeds: [coreqEmbed], components: [row], fetchReply: true });
            }

            // Only add a collector if there's more than one page
            if (coreqs.length > 1 && sentMessage) {
                try { collectorManager.stop('coreqs'); } catch (e) { /* ignore */ }
                const collector = collectorManager.create('coreqs', sentMessage, { filter: i => i.user.id === interaction.user.id, time: 120000 });

                collector.on('collect', async i => {
                    try {
                        if (i.customId === 'go_to_courselist') {
                            // Delegate to the course_list command and stop this collector to avoid double-handling
                            try { collectorManager.stop('coreqs', 'navigated'); } catch (e) { /* ignore */ }
                            try { await courseList.execute(i, true); } catch (e) { console.error('Delegating to course_list failed:', e); }
                            return;
                        }

                        if (i.customId === 'previous') {
                            if (page > 0) page -= 1;
                        } else if (i.customId === 'next') {
                            if (page < maxPage) page += 1;
                        }

                        const updatedEmbed = generateEmbed(page);
                        const updatedRow = generateButtons(page);

                        try {
                            if (!i.deferred && !i.replied) {
                                await i.update({ embeds: [updatedEmbed], components: [updatedRow] });
                            } else if (i.message) {
                                await i.message.edit({ embeds: [updatedEmbed], components: [updatedRow] });
                            } else if (sentMessage) {
                                await sentMessage.edit({ embeds: [updatedEmbed], components: [updatedRow] });
                            } else {
                                try { await i.followUp({ embeds: [updatedEmbed], components: [updatedRow], ephemeral: true }); } catch (e) { /* ignore */ }
                            }
                        } catch (err) {
                            console.warn('coreq update/edit fallback failed:', err?.message || err);
                            try { if (sentMessage) await sentMessage.edit({ embeds: [updatedEmbed], components: [updatedRow] }); } catch (e) { console.error('coreq final fallback edit failed:', e); }
                        }
                    } catch (err) {
                        console.error('Pagination collector error:', err);
                    }
                });

                collector.on('end', async (collected, reason) => {
                    try {
                        const info = collectorManager.getInfo('coreqs');
                        if (info && info.collector === collector && info.messageId === sentMessage.id) {
                            if (reason === 'time') {
                                const disabledRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('previous').setLabel('⬅️ Prev').setStyle(ButtonStyle.Primary).setDisabled(true),
                                    new ButtonBuilder().setCustomId('next').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(true)
                                );

                                try { await sentMessage.edit({ components: [disabledRow] }); } catch (e) { /* ignore */ }
                            }
                        }
                    } catch (e) { /* ignore */ }
                });
            }

            return;
            
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
}