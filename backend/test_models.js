const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

console.log(`🔑 Testing API Key: ${API_KEY ? 'Present' : 'Missing'}`);

async function listModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        console.log(`🌐 Querying: ${url}`);

        const response = await axios.get(url);

        console.log("\n✅ Available Models:");
        if (response.data && response.data.models) {
            response.data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`   - ${m.name} (${m.displayName})`);
                }
            });
        } else {
            console.log("No models found in response.");
        }

    } catch (error) {
        console.error("\n❌ Error Listing Models:");
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`   Message: ${error.message}`);
        }
    }
}

// Test generation quickly
async function testGeneration(modelName) {
    try {
        console.log(`\n🤖 Testing generation with ${modelName}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${API_KEY}`;

        const payload = {
            contents: [{ parts: [{ text: "Hello, are you working?" }] }]
        };

        const response = await axios.post(url, payload);
        console.log(`   ✅ Success! Response: ${response.data.candidates[0].content.parts[0].text.substring(0, 50)}...`);
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
}

const fs = require('fs');

async function run() {
    console.log("Starting test...");
    const results = { models: [], flashError: null, success: false };

    // 1. List Models
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await axios.get(url);
        if (response.data && response.data.models) {
            results.models = response.data.models.map(m => m.name);
        }
    } catch (e) {
        results.listError = e.message;
        if (e.response) results.listErrorData = e.response.data;
    }

    // 2. Test Flash specifically
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        const payload = { contents: [{ parts: [{ text: "Hello" }] }] };
        await axios.post(url, payload);
        results.success = true;
    } catch (e) {
        results.flashError = e.message;
        if (e.response) results.flashErrorStatus = e.response.status;
        if (e.response) results.flashErrorData = e.response.data;
    }

    fs.writeFileSync('result.json', JSON.stringify(results, null, 2));
    console.log("Done. Check result.json");
}

run();
