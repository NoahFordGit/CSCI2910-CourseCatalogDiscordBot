const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');
const degreeInfo = require('./degree_info');
const collectorManager = require('../../utils/collectorManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('degree_list')
        .setDescription('Displays a paginated list of all degrees.'),

    async execute(interaction, fromButton = false) {
        let fallbackToMessage = false;
        try {
            if (!fromButton) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            } else {
                if (!interaction.deferred && !interaction.replied) {
                    try {
                        await interaction.deferUpdate();
                    } catch (err) {
                        console.warn('deferUpdate failed in degree_list.execute, will fallback to message.edit:', err?.message || err);
                        fallbackToMessage = true;
                    }
                }
            }
        } catch (err) {
            console.warn('Acknowledgement step failed in degree_list.execute:', err?.message || err);
            fallbackToMessage = true;
        }
        
        let degrees = [];
        try {
            const response = await axios.get('http://127.0.0.1:8000/degrees/');
            degrees = Array.isArray(response.data) ? response.data : [];
            
        } catch (error) {
            console.log('Error fetching degree list:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Degree List')
                .setDescription(`Could not fetch list of degrees. Please try again later.`);

            if (fromButton) {
                return await interaction.reply({ embeds: [errorEmbed] });
            } else {
                return await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
        
        const pageSize = 15;
        let page = 0;
        const maxPage = Math.ceil(degrees.length / pageSize) - 1;
        
        const generateEmbed = (page) => {
            const start = page * pageSize;
            const end = start + pageSize;
            const currentDegrees = degrees.slice(start, end);

            const pageEmbed = new EmbedBuilder()
                .setColor(0xFFC72C)
                .setTitle('Available Degrees')
                .setDescription(
                    currentDegrees.map(d => {
                        const concentration = d.concentration ? ` (${d.concentration})` : '';
                        return `**${d.title}**${concentration}`;
                    }).join('\n')
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
            const currentDegrees = degrees.slice(start, end);

            const options = currentDegrees.map(d => {
                const concentration = d.concentration ? ` (${d.concentration})` : '';
                const label = `${d.title}${concentration}`.slice(0, 100);
                return {
                    label: label,
                    value: d.degree_id.toString()
                };
            });

            return new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_degree')
                    .setPlaceholder('Select a degree to view details')
                    .addOptions(options.slice(0, 25))
            );
        };

        const embed = generateEmbed(page);
        const components = [generateButtons(), generateSelectMenu()];
        let message;

        if (fallbackToMessage && interaction.message) {
            try {
                console.log('Fallback: editing original message with degreelist');
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
            console.log("Editing reply with degreelist");
            message = await interaction.editReply({ embeds: [embed], components, fetchReply: true});
        } else {
            console.log("Replying with degreelist");
            message = await interaction.reply({ embeds: [embed], components, fetchReply: true});
        }

        try { collectorManager.stop('degreelist'); } catch (e) { /* ignore */ }
        const collector = collectorManager.create('degreelist', message, { time: 5 * 60 * 1000 });
        if (collector) console.log('Collector created for degreelist');

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
                if (i.customId === 'go_to_degreelist') {
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

            if (i.isStringSelectMenu() && i.customId === 'select_degree') {
                const selectedDegreeId = i.values[0];
                const selectedDegree = degrees.find(d => d.degree_id.toString() === selectedDegreeId);
                
                if (selectedDegree) {
                    try {
                        // Create a mock interaction options object for degree_info
                        const mockInteraction = {
                            ...i,
                            options: {
                                getString: (name) => {
                                    if (name === 'title') return selectedDegree.title;
                                    if (name === 'concentration') return selectedDegree.concentration || '';
                                    return null;
                                }
                            }
                        };
                        
                        await degreeInfo.execute(mockInteraction, null, true);

                        try {
                            const info = collectorManager.getInfo('degreelist');
                            if (info && info.collector === collector) collectorManager.stop('degreelist', 'navigated');
                        } catch (e) { /* ignore */ }

                    } catch (err) {
                        console.warn('degreeInfo execute failed from select, falling back:', err?.message || err);
                        try {
                            if (!i.deferred && !i.replied) await i.deferUpdate();
                            await message.edit({ embeds: [generateEmbed(page)], components: [generateButtons(), generateSelectMenu()] });
                        } catch (innerErr) {
                            console.error('Fallback edit failed:', innerErr);
                        }
                    }
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            try {
                const info = collectorManager.getInfo('degreelist');
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
    },
};
