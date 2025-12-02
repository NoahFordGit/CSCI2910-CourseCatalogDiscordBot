const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');
const courseInfo = require('./course_info');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('course_list')
        .setDescription('Displays a list of available courses.'),

    // Execute handler
    async execute(interaction, fromButton = false) {
        if (!fromButton) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } else {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        }
        
        let courses = [];
        try {
            const response = await axios.get('http://127.0.0.1:8000/courses/');
            courses = Array.isArray(response.data) ? response.data : [];
            
        } catch (error) {
            console.log('Error fetching course list:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Course List')
                .setDescription(`Could not fetch list of courses. Please try again later.`);

            if (fromButton) {
                return await interaction.reply({ embeds: [errorEmbed] });
            } else {
                return await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
        
        const pageSize = 15;
        let page = 0;
        const maxPage = Math.ceil(courses.length / pageSize) - 1;
        
        // UI Components
        const generateEmbed = (page) => {
            const start = page * pageSize;
            const end = start + pageSize;
            const currentCourses = courses.slice(start, end);

            const pageEmbed = new EmbedBuilder()
                .setColor(0xFFC72C)
                .setTitle('Available Courses')
                .setDescription(
                    currentCourses.map(c => 
                        `\`${c.course_id.padEnd(8)}\` ${c.title.slice(0, 60)}`
                    ).join('\n')
                )
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                .setTimestamp()
                .setFooter({ text: `Page ${page + 1} / ${maxPage}` })

            return pageEmbed
        };
        
        const generateButtons = () => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('⬅️ Prev')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === maxPage)
            );
        };

        const generateSelectMenu = () => {
            const start = page * pageSize;
            const end = start + pageSize;
            const currentCourses = courses.slice(start, end);

            const options = currentCourses.map(c => ({
                label: `${c.course_id}: ${c.title}`.slice(0, 100),
                value: c.course_id
            }));

            return new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_course')
                    .setPlaceholder('Select a course to view details')
                    .addOptions(options.slice(0, 25))
            );
        };

        const embed = generateEmbed(page);
        const components = [generateButtons(), generateSelectMenu()];
        let message;

        if (interaction.replied || interaction.deferred) {
            console.log("Editing reply with courselist");
            message = await interaction.editReply({ embeds: [embed], components, fetchReply: true});
        } else {
            console.log("Replying with courselist");
            message = await interaction.reply({ embeds: [embed], components, fetchReply: true});
        }

        try {
            if (globalThis._courselistCollector) {
                try {
                    if (globalThis._courselistCollector.collector) globalThis._courselistCollector.collector.stop('replaced');
                    else globalThis._courselistCollector.stop('replaced');
                } catch (e) { /* ignore */ }
                delete globalThis._courselistCollector;
            }
        } catch (e) { /* ignore */ }

        // Collector for buttons and select menu
        const collector = message.createMessageComponentCollector({ time: 5 * 60 * 1000 }); // 5 min
        globalThis._courselistCollector = { collector, messageId: message.id };

        if (collector)
            console.log("Collector created for courselist");

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                try {
                    await i.reply({ content: 'These controls are not for you!', ephemeral: true });
                } catch (err) {
                    console.debug('ignored unauthorized click reply error:', err?.message || err);
                }
                return;
            }

            // Button handling
            if (i.isButton()) {
                console.log(`Button ${i.customId} clicked`);

                if (i.customId === 'previous' && page > 0) page--;
                if (i.customId === 'next' && page < maxPage) page++;
                if (i.customId === 'go_to_courselist') {
                    return;
                }

                try {
                    if (!i.deferred && !i.replied) {
                        await i.update({ 
                            embeds: [generateEmbed(page)], 
                            components: [generateButtons(), generateSelectMenu()]
                        });
                    } else {
                        if (i.message) await i.message.edit({ embeds: [generateEmbed(page)], components: [generateButtons(), generateSelectMenu()] });
                    }
                } catch (err) {
                    console.warn('i.update failed, falling back to message.edit:', err?.message || err);
                    try { if (i.message) await i.message.edit({ embeds: [generateEmbed(page)], components: [generateButtons(), generateSelectMenu()] }); } catch (e) { console.error('fallback message.edit failed:', e); }
                }
            }

            // Select menu handling
            if (i.isStringSelectMenu() && i.customId === 'select_course') {
                const selectedCourseId = i.values[0];
                try {
                    await courseInfo.execute(i, selectedCourseId, true);

                    try {
                        if (globalThis._courselistCollector && globalThis._courselistCollector.collector === collector) {
                            collector.stop('navigated');
                            delete globalThis._courselistCollector;
                        }
                    } catch (e) { /* ignore */ }

                } catch (err) {
                    console.warn('courseInfo execute failed from select, falling back:', err?.message || err);
                    try {
                        if (!i.deferred && !i.replied) await i.deferUpdate();
                        await message.edit({ embeds: [generateEmbed(page)], components: [generateButtons(), generateSelectMenu()] });
                    } catch (innerErr) {
                        console.error('Fallback edit failed:', innerErr);
                    }
                }
            }
        });

        // Collector end handling
        collector.on('end', async (collected, reason) => {
            try {
                if (
                    globalThis._courselistCollector &&
                    globalThis._courselistCollector.collector === collector &&
                    globalThis._courselistCollector.messageId === message.id
                ) {
                    delete globalThis._courselistCollector;

                    if (reason === 'time') {
                        // Disable buttons/select menu after timeout
                        const disabledRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('previous').setLabel('⬅️ Prev').setStyle(ButtonStyle.Primary).setDisabled(true),
                            new ButtonBuilder().setCustomId('next').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(true)
                        );

                        try {
                            await message.edit({ components: [disabledRow] });
                        } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) { /* ignore */ }
        });
    },
}