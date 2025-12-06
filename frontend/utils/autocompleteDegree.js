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
            
            // Get unique titles
            const uniqueTitles = [...new Set(degrees.map(d => d.title))];
            
            const choices = uniqueTitles.slice(0, 25).map(title => ({
                name: title,
                value: title
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
            
            const choices = degrees.slice(0, 25).map(degree => ({
                name: degree.concentration || 'None',
                value: degree.concentration || ''
            }));
            
            await interaction.respond(choices);
        } catch (error) {
            await interaction.respond([]);
        }
    }
};
