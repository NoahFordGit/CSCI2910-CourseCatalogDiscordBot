const axios = require("axios");

module.exports = async function autocompleteCourseId(interaction) {
    const focused = interaction.options.getFocused();
    const FASTAPI_URL = `http://127.0.0.1:8000/courses/search?id=${encodeURIComponent(focused)}`;

    try {
        const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
        const courses = Array.isArray(response.data) ? response.data : [];

        const choices = courses.slice(0, 25).map(course => ({
            name: course.course_id,
            value: course.course_id
        }));

        await interaction.respond(choices);

    } catch (error) {
        await interaction.respond([]);
    }
};