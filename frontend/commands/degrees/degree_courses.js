const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const autocompleteDegree = require('../../utils/autocompleteDegree');
const axios = require('axios');
const collectorManager = require('../../utils/collectorManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('degree_courses')
        .setDescription('View all courses for a specific degree.')
        .addStringOption(option => 
            option.setName('title')
                .setDescription('Start typing a degree title... (autocomplete only shows first 25 results)')
                .setAutocomplete(true)
                .setRequired(true)
        ),
    
    autocomplete: autocompleteDegree,

    async execute(interaction, degreeId, fromButton = false) {
        let fallbackToMessage = false;
        try {
            if (!fromButton) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            } else {
                if (!interaction.deferred && !interaction.replied) {
                    try {
                        await interaction.deferUpdate();
                    } catch (err) {
                        console.warn('deferUpdate failed in degree_courses.execute, will fallback to message.edit:', err?.message || err);
                        fallbackToMessage = true;
                    }
                }
            }
        } catch (err) {
            console.warn('Acknowledgement step failed in degree_courses.execute:', err?.message || err);
            fallbackToMessage = true;
        }

        try {
            let actualDegreeId = degreeId;
            let degreeTitle = '';

            if (!degreeId) {
                const rawTitle = interaction.options.getString('title');
                const concentration = interaction.options.getString('concentration') || '';

                if (rawTitle && /^\d+$/.test(rawTitle)) {
                    actualDegreeId = parseInt(rawTitle, 10);
                    const degreeResponse = await axios.get(`http://127.0.0.1:8000/degrees/${actualDegreeId}`, { timeout: 2000 });
                    const degree = degreeResponse.data;
                    degreeTitle = degree.title;
                    if (degree.concentration) degreeTitle += ` (${degree.concentration})`;
                } else {
                    let FASTAPI_URL = `http://127.0.0.1:8000/degrees/search?title=${encodeURIComponent(rawTitle)}`;
                    if (concentration) {
                        FASTAPI_URL += `&concentration=${encodeURIComponent(concentration)}`;
                    }

                    const degreeResponse = await axios.get(FASTAPI_URL, { timeout: 2000 });
                    const degrees = Array.isArray(degreeResponse.data) ? degreeResponse.data : [];

                    if (degrees.length === 0) {
                        throw new Error('Degree not found.');
                    }

                    actualDegreeId = degrees[0].degree_id;
                    degreeTitle = degrees[0].title;
                    if (degrees[0].concentration) {
                        degreeTitle += ` (${degrees[0].concentration})`;
                    }
                }
            } else {
                const degreeResponse = await axios.get(`http://127.0.0.1:8000/degrees/${actualDegreeId}`, { timeout: 2000 });
                const degree = degreeResponse.data;
                degreeTitle = degree.title;
                if (degree.concentration) {
                    degreeTitle += ` (${degree.concentration})`;
                }
            }
            
            const coursesResponse = await axios.get(`http://127.0.0.1:8000/degrees/${actualDegreeId}/courses`, { timeout: 2000 });
            const courses = Array.isArray(coursesResponse.data) ? coursesResponse.data : [];
            
            if (courses.length === 0) {
                const noCourseEmbed = new EmbedBuilder()
                    .setColor(0xFFC72C)
                    .setTitle(`Courses for ${degreeTitle}`)
                    .setDescription('No courses found for this degree.')
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                    .setTimestamp()
                    .setFooter({ text: `Requested by ${interaction.user.tag}` });
                
                if (fromButton && fallbackToMessage && interaction.message) {
                    return await interaction.message.edit({ embeds: [noCourseEmbed], components: [] });
                } else if (interaction.replied || interaction.deferred) {
                    return await interaction.editReply({ embeds: [noCourseEmbed], components: [] });
                } else {
                    return await interaction.reply({ embeds: [noCourseEmbed], components: [] });
                }
            }
            
            const pageSize = 15;
            let page = 0;
            const maxPage = Math.ceil(courses.length / pageSize) - 1;
            
            const generateEmbed = (page) => {
                const start = page * pageSize;
                const end = start + pageSize;
                const currentCourses = courses.slice(start, end);

                const pageEmbed = new EmbedBuilder()
                    .setColor(0xFFC72C)
                    .setTitle(`Courses for ${degreeTitle}`)
                    .setDescription(
                        currentCourses.map(c => 
                            `\`${c.course_id.padEnd(8)}\` ${c.title.slice(0, 60)}`
                        ).join('\n')
                )
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                    .setTimestamp()
                    .setFooter({ text: `Page ${page + 1} / ${maxPage + 1}` });

                return pageEmbed;
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
                        .setCustomId('select_course_from_degree')
                        .setPlaceholder('Select a course to view details')
                        .addOptions(options.slice(0, 25))
                );
            };

            const embed = generateEmbed(page);
            const components = courses.length > pageSize ? [generateButtons(), generateSelectMenu()] : [generateSelectMenu()];
            let message;

            if (fallbackToMessage && interaction.message) {
                try {
                    console.log('Fallback: editing original message with degree_courses');
                    message = await interaction.message.edit({ embeds: [embed], components, fetchReply: true });
                } catch (err) {
                    console.warn('Fallback message.edit failed, will try reply/editReply instead:', err?.message || err);
                    if (interaction.replied || interaction.deferred) {
                        message = await interaction.editReply({ embeds: [embed], components, fetchReply: true});
                    } else {
                        message = await interaction.reply({ embeds: [embed], components, fetchReply: true});
                    }
                }
            } else if (interaction.replied || interaction.deferred) {
                console.log("Editing reply with degree_courses");
                message = await interaction.editReply({ embeds: [embed], components, fetchReply: true});
            } else {
                console.log("Replying with degree_courses");
                message = await interaction.reply({ embeds: [embed], components, fetchReply: true});
            }

            try { collectorManager.stop('degree_courses'); } catch (e) { /* ignore */ }
            const collector = collectorManager.create('degree_courses', message, { time: 5 * 60 * 1000 });
            if (collector) console.log('Collector created for degree_courses');

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    try {
                        await i.reply({ content: 'These controls are not for you!', ephemeral: true });
                    } catch (err) {
                        console.debug('ignored unauthorized click reply error:', err?.message || err);
                    }
                    return;
                }

                if (i.isButton()) {
                    console.log(`Button ${i.customId} clicked`);

                    if (i.customId === 'previous' && page > 0) page--;
                    if (i.customId === 'next' && page < maxPage) page++;

                    try {
                        if (!i.deferred && !i.replied) {
                            await i.update({ 
                                embeds: [generateEmbed(page)], 
                                components: courses.length > pageSize ? [generateButtons(), generateSelectMenu()] : [generateSelectMenu()]
                            });
                        } else {
                            if (i.message) await i.message.edit({ embeds: [generateEmbed(page)], components: courses.length > pageSize ? [generateButtons(), generateSelectMenu()] : [generateSelectMenu()] });
                        }
                    } catch (err) {
                        console.warn('i.update failed, falling back to message.edit:', err?.message || err);
                        try { if (i.message) await i.message.edit({ embeds: [generateEmbed(page)], components: courses.length > pageSize ? [generateButtons(), generateSelectMenu()] : [generateSelectMenu()] }); } catch (e) { console.error('fallback message.edit failed:', e); }
                    }
                }

                if (i.isStringSelectMenu() && i.customId === 'select_course_from_degree') {
                    const selectedCourseId = i.values[0];
                    
                    try {
                        const courseInfo = require('../courses/course_info');
                        await courseInfo.execute(i, selectedCourseId, true);

                        try {
                            const info = collectorManager.getInfo('degree_courses');
                            if (info && info.collector === collector) collectorManager.stop('degree_courses', 'navigated');
                        } catch (e) { /* ignore */ }

                    } catch (err) {
                        console.warn('courseInfo execute failed from select, falling back:', err?.message || err);
                        try {
                            if (!i.deferred && !i.replied) await i.deferUpdate();
                            await message.edit({ embeds: [generateEmbed(page)], components: courses.length > pageSize ? [generateButtons(), generateSelectMenu()] : [generateSelectMenu()] });
                        } catch (innerErr) {
                            console.error('Fallback edit failed:', innerErr);
                        }
                    }
                }
            });

            collector.on('end', async (collected, reason) => {
                try {
                    const info = collectorManager.getInfo('degree_courses');
                    if (info && info.collector === collector && info.messageId === message.id) {
                        if (reason === 'time') {
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

        } catch (error) {
            console.log('Error fetching degree courses:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Degree Courses')
                .setDescription(`Could not fetch courses for this degree. Please try again.`);

            if (fromButton && fallbackToMessage && interaction.message) {
                return await interaction.message.edit({ embeds: [errorEmbed], components: [] });
            } else if (interaction.replied || interaction.deferred) {
                return await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                return await interaction.reply({ embeds: [errorEmbed] });
            }
        }
    },
};
