const axios = require("axios");

module.exports = async function autocompleteDegree(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const focused = focusedOption.value;
    
    // Get the current title value to filter concentrations
    const title = interaction.options.getString('title');
    
    if (focusedOption.name === 'title') {
        const FASTAPI_URL = `http://127.0.0.1:8000/degrees/search?title=${encodeURIComponent(focused)}`;
        
        try {
            const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
            const degrees = Array.isArray(response.data) ? response.data : [];
            const choices = degrees.slice(0, 25).map(d => ({
                name: d.concentration ? `${d.title} - ${d.concentration}` : d.title,
                value: String(d.degree_id)
            }));
            
            await interaction.respond(choices);
        } catch (error) {
            await interaction.respond([]);
        }
    } else if (focusedOption.name === 'concentration') {
        if (!title) {
            await interaction.respond([]);
            return;
        }
        
        const FASTAPI_URL = `http://127.0.0.1:8000/degrees/search?title=${encodeURIComponent(title)}&concentration=${encodeURIComponent(focused)}`;
        
        try {
            const response = await axios.get(FASTAPI_URL, { timeout: 2000 });
            const degrees = Array.isArray(response.data) ? response.data : [];
            // Return unique concentrations for the selected title
            const uniqueConcs = [...new Set(degrees.map(d => d.concentration || ''))];
            const choices = uniqueConcs.slice(0, 25).map(c => ({
                name: c || 'None',
                value: c || ''
            }));
            
            await interaction.respond(choices);
        } catch (error) {
            await interaction.respond([]);
        }
    }
};
