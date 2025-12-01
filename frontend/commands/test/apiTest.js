const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
 
// Define your FastAPI base URL
const FASTAPI_URL = 'http://127.0.0.1:8000'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apicalltest')
        .setDescription('Tests a call to the FastAPI backend and replies with the text response.'),

    async execute(interaction) {
        // Defer the reply to prevent timeouts during the API call
        await interaction.deferReply(); 

        try {
            // 1. Make the API call to the specified endpoint
            const response = await axios.get(`${FASTAPI_URL}/courses/CSCI2910`);
            
            // 2. Extract the 'message' field from the JSON response
            const responseMessage = response.data.title || 'No title found in response';
            
            // 3. Edit the reply with the simple text response
            await interaction.editReply(`✅ **FastAPI Call Success!**\nServer message: \`${responseMessage}\`\nHTTP Status: ${response.status}`);

        } catch (error) {
            console.error('FastAPI Call Error:', error.message);
            
            // 4. Handle errors
            await interaction.editReply(`❌ **FastAPI Call Failed!**\nError: \`${error.message}\`\n(Is the server running at ${FASTAPI_URL}?)`);
        }
    },
};