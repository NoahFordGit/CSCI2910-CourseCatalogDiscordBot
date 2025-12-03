const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const autocompleteCourseId = require('../../utils/autocompleteCourseId'); 
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('course_requisites')
        .setDescription('Look up course requisites from a Course ID (e.g., CSCI1250).')
        .addStringOption(option => 
            option.setName('courseid')
                .setDescription('Start typing a Course ID... (autocomplete only shows first 25 results)')
                .setAutocomplete(true)
                .setRequired(true)
        ),

    // Autocomplete handler
    autocomplete: autocompleteCourseId,
    
    // Execute handler
	async execute(interaction, courseID = null, fromButton = false) {
        try {
            const courseId = courseID || interaction.options?.getString('courseid');
            const REQUISITE_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}/requisites`;
            const COURSE_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}`;

            let reqResponse, courseResponse;
            
            try {
                reqResponse = await axios.get(REQUISITE_URL, { timeout: 2000 });
                courseResponse = await axios.get(COURSE_URL, { timeout: 2000 });
            } catch (err) {
                if (err.response?.status === 404) {
                    throw new Error('Course not found. Please check the Course ID and try again.');
                }
                throw err;
            }

            // Validate response data
            if (!courseResponse.data || typeof courseResponse.data !== 'object' || !courseResponse.data.course_id) {
                throw new Error('Invalid course data received from API.');
            }
            if (!Array.isArray(reqResponse.data)) {
                throw new Error('Invalid requisites data received from API.');
            }

            const courseTitle = courseResponse.data.title || 'N/A';
            let prereqIds = [];
            let coreqIds = [];
            let prereqData = [];
            let coreqData = [];

            // populate requisite id's
            for (const req of reqResponse.data) {
                if (req.prereq_id) {
                    prereqIds.push(req.prereq_id);
                }
                if (req.coreq_id) {
                    coreqIds.push(req.coreq_id);
                }
            }

            // get requisite course data
            prereqData = await Promise.all(
                prereqIds.map(async (id) => {
                    try {
                        const res = await axios.get(
                            `http://127.0.0.1:8000/courses/${encodeURIComponent(id)}`,
                            { timeout: 2000 }
                        );
                        return res.data;
                    } catch {
                        return null; // failure-safe placeholder
                    }
                })
            ).then(results => results.filter(Boolean)); // remove nulls

            // Fetch corequisite course data in parallel
            coreqData = await Promise.all(
                coreqIds.map(async (id) => {
                    try {
                        const res = await axios.get(
                            `http://127.0.0.1:8000/courses/${encodeURIComponent(id)}`,
                            { timeout: 2000 }
                        );
                        return res.data;
                    } catch {
                        return null;
                    }
                })
            ).then(results => results.filter(Boolean));

            // Determine interaction type and make sure we don't double-defer/reply
            if (!fromButton) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            }
            
            // Embed
            const requisiteEmbed = new EmbedBuilder()
                .setColor(0xFFC72C)
                .setTitle(`Requisite Courses for ${courseId}`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/East_Tennessee_State_Buccaneers_logo.svg/1200px-East_Tennessee_State_Buccaneers_logo.png')
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}` });

            requisiteEmbed.addFields(
                {
                    name: 'Title',
                    value: courseTitle,
                    inline: false
                },
                { 
                    name: 'Prerequisites', 
                    value: prereqIds.length > 0
                        ? prereqIds
                            .map((id, idx) => `\`${id}\` — ${prereqData[idx].title}`)
                            .join("\n")
                        : "\`None\`",
                    inline: true 
                },
                {
                    name: '\u200B',   // spacer field
                    value: '\u200B',
                    inline: true
                },
                { 
                    name: 'Corequisites', 
                    value: coreqIds.length > 0 
                        ? coreqIds
                            .map((id, idx) => `\`${id}\` — ${coreqData[idx].title}`)
                            .join("\n")
                        : "\`None\`",
                    inline: true 
                },
            );

            // Button row
            const buttons = [
                new ButtonBuilder()
                    .setCustomId('go_to_courselist')
                    .setLabel('See all Courses')
                    .setStyle(ButtonStyle.Success),
            ];

            if (prereqIds.length > 0) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`go_to_prerequisites:${courseId}`)
                        .setLabel('See Prerequisite Info')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (coreqIds.length > 0) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`go_to_corequisites:${courseId}`)
                        .setLabel('See Corequisite Info')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            const row = new ActionRowBuilder().addComponents(buttons);
            
            if (fromButton) {
                // Prefer a single interaction.update() when possible to both acknowledge and update the original message.
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        return await interaction.update({ embeds: [requisiteEmbed], components: [row] });
                    }

                    // If the interaction was already acknowledged, edit the original message directly.
                    if (interaction.message) {
                        await interaction.message.edit({ embeds: [requisiteEmbed], components: [row] });
                        return;
                    }

                    // As a safe fallback, attempt a followUp (ephemeral) so the user still sees the result.
                    return await interaction.followUp({ embeds: [requisiteEmbed], components: [row], ephemeral: true });
                } catch (err) {
                    // If update fails (unknown/expired interaction) try a direct message edit fallback.
                    if (interaction.message) {
                        try { await interaction.message.edit({ embeds: [requisiteEmbed], components: [row] }); return; } catch (e) {}
                    }
                    // Final fallback: try to reply or followUp however possible
                    try { if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate(); } catch (e) {}
                    try { return await interaction.followUp({ embeds: [requisiteEmbed], components: [row], ephemeral: true }); } catch (e) {}
                }
            } else {
                return await interaction.editReply({ embeds: [requisiteEmbed], components: [row], fetchReply: true });
            }

        } catch (error) {
            console.log('Error fetching course information:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF2C2C)
                .setTitle('Error Fetching Requisite Information')
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