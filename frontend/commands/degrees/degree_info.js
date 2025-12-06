const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const autocompleteDegree = require('../../utils/autocompleteDegree');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('degree_info')
        .setDescription('Look up degree information by title and optional concentration.')
        .addStringOption(option => 
            option.setName('title')
                .setDescription('Start typing a degree title... (autocomplete only shows first 25 results)')
                .setAutocomplete(true)
                .setRequired(true)
        ),
        
    autocomplete: autocompleteDegree,

    async execute(interaction, degreeData, fromButton = false) {
        try {
            const rawTitle = interaction.options.getString('title');
            let title = rawTitle;
            let concentration = interaction.options.getString('concentration') || '';
            let degree = null;

            if (rawTitle && /^\d+$/.test(rawTitle)) {
                const degreeId = parseInt(rawTitle, 10);
                try {
                    const resp = await axios.get(`http://127.0.0.1:8000/degrees/${degreeId}`, { timeout: 2000 });
                    degree = resp.data;
                } catch (err) {
                    if (err.response?.status === 404) {
                        throw new Error('Degree not found. Please check the title and try again.');
                    }
                    throw err;
                }
                title = degree.title;
                if (!concentration && degree.concentration) concentration = degree.concentration;
            } else {
                let FASTAPI_URL = `http://127.0.0.1:8000/degrees/search?title=${encodeURIComponent(title)}`;
                if (concentration) {
                    FASTAPI_URL += `&concentration=${encodeURIComponent(concentration)}`;
                }

                let response;
                try {
                    response = await axios.get(FASTAPI_URL, { timeout: 2000 });
                } catch (err) {
                    if (err.response?.status === 404) {
                        throw new Error('Degree not found. Please check the title and try again.');
                    }
                    throw err;
                }

                const degrees = Array.isArray(response.data) ? response.data : [];
                if (degrees.length === 0) {
                    throw new Error('Degree not found. Please check the title and concentration.');
                }

                degree = degrees[0];
            }
            
            if (!fromButton) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            }
            
            const degreeEmbed = new EmbedBuilder()
                .setColor(0xFFC72C)
                .setTitle(`Degree Information`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}` });

            degreeEmbed.addFields(
                { name: 'Title', value: degree.title || 'N/A', inline: false },
                { name: 'Type', value: degree.type || 'N/A', inline: true },
                { name: 'Level', value: degree.level || 'N/A', inline: true },
                { name: 'Department', value: degree.department || 'N/A', inline: false },
                { name: 'Concentration', value: degree.concentration || 'None', inline: false },
                { name: 'Description', value: degree.description || 'N/A', inline: false }
            );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('go_to_degreelist')
                    .setLabel('See all Degrees')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`go_to_degree_courses:${degree.degree_id}`)
                    .setLabel('See Degree Courses')
                    .setStyle(ButtonStyle.Primary)
            );
            
            if (fromButton) {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        return await interaction.update({ embeds: [degreeEmbed], components: [row] });
                    }

                    if (interaction.message) {
                        await interaction.message.edit({ embeds: [degreeEmbed], components: [row] });
                        return;
                    }

                    return await interaction.followUp({ embeds: [degreeEmbed], components: [row], ephemeral: true });
                } catch (err) {
                    if (interaction.message) {
                        try { await interaction.message.edit({ embeds: [degreeEmbed], components: [row] }); return; } catch (e) {}
                    }
                    try { if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate(); } catch (e) {}
                    try { return await interaction.followUp({ embeds: [degreeEmbed], components: [row], ephemeral: true }); } catch (e) {}
                }
            } else {
                return await interaction.editReply({ embeds: [degreeEmbed], components: [row], fetchReply: true });
            }

        } catch (error) {
            console.log('Error fetching degree information:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Degree Information')
                .setDescription(`Could not fetch degree, please ensure title and concentration are valid.`);

            if (fromButton) {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.update({ embeds: [errorEmbed], components: [] });
                        return;
                    }
                } catch (err) {
                    if (interaction.message) {
                        try { await interaction.message.edit({ embeds: [errorEmbed], components: [] }); return; } catch (e) {}
                    }
                    try { await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }); return; } catch (e) {}
                }
                return;
            }

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
