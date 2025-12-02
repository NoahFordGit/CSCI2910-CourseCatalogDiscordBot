const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
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
            const REQUISITE_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}/requisites`;
            const COURSE_URL = `http://127.0.0.1:8000/courses/${encodeURIComponent(courseId)}`;

            const reqResponse = await axios.get(REQUISITE_URL, { timeout: 2000 });
            const courseResponse = await axios.get(COURSE_URL, { timeout: 2000 });

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
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('go_to_courselist')
                    .setLabel('See all courses')
                    .setStyle(ButtonStyle.Primary)
            );
            
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