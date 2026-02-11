require('dotenv').config();
const WebSocket = require('ws');
const fetch = require('node-fetch')

// MCP server URL
const MCP_SERVER_URL = process.env.MCP_SERVER_URL;

// Connect to MCP server
const mcpClient = new WebSocket(MCP_SERVER_URL);

// Promises to handle responses
const pendingRequests = {};

// Generate unique IDs for each user prompt
function generateRequestId() {
    return Math.random().toString(36).substring(2, 9);
}

// On open, send a handshake if needed
mcpClient.on('open', () => {
    console.log('Connected to MCP server');
    // Handshake
    mcpClient.send(JSON.stringify({ type: 'handshake', clientId: 'client-001' }));
});

function sendPromptToMCP(prompt) {
    return new Promise((resolve, reject) => {
        const requestId = generateRequestId();
        pendingRequests[requestId] = { resolve, reject };

        mcpClient.send(JSON.stringify({
            type: 'query',
            requestId: requestId,
            query: prompt
        }));
        
        // Timeout in case server doesn't respond
        setTimeout(() => {
            if (pendingRequests[requestId]) {
                pendingRequests[requestId].reject('Timeout waiting for MCP server response');
                delete pendingRequests[requestId];
            }
        }, 10000); // 10 seconds timeout
    });
}

async function callGeminiLLM(context, prompt) { 
    const response = await fetch('https://gemini.api.endpoint', { // Replace with actual Gemini API endpoint
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${process.env.GEMINI_API_KEY}' // Replace with actual API key
        },
        body: JSON.stringify({
            model: 'gemini-1.5', // Replace with actual model name
            input: '${prompt}\nContext: ${JSON.stringify(context)}',
        })
    });

    const result = await response.json();
    console.log('Gemini Response:', result);
}

// Listen for messages from MCP server
mcpClientClient.on('message', async (data) => {
    try {
        const message = JSON.parse(data);

        // Check if it's a response to a query
        if (message.type === 'response' && message.requestId) {
            const { requestId, answer } = message;
            if (pendingRequests[requestId]) {
                pendingRequests[requestId].resolve(answer);
                delete pendingRequests[requestId];
            }
        }
    } catch (err) {
        console.error('Error processing message from MCP server:', err);
    }
});

mcpClient.on('open', () => console.log('Connected to MCP server'));
mcpClient.on('error', (err) => console.error('MCP error:', err));
mcpClient.on('close', () => console.log('MCP connection closed'));

// Function to handle user prompt and get responses from both MCP and Gemini LLM
async function handleUserPrompt(prompt) {
    try {
        const mcpResponse = await sendPromptToMCP(prompt);
        console.log('MCP Response:', mcpResponse);

        const geminiResponse = await callGeminiLLM(context, prompt);
        console.log('Gemini Response:', geminiResponse);
    } catch (err) {
        console.error('Error handling user prompt:', err);
    }
}

// E.g.
// handleUserPrompt('What is fire?');