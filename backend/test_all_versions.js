const axios = require('axios');

const key = "AIzaSyBkylqxJcv4dwyAW6_P4cCwIacFrs7Foks";
console.log("Testing both API versions...\n");

async function testBothVersions() {
    const versions = ['v1beta', 'v1'];
    const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.5-pro'];

    for (const version of versions) {
        for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${key}`;

            const payload = {
                contents: [{ parts: [{ text: "Hi" }] }]
            };

            try {
                console.log(`Trying ${version}/${model}...`);
                const response = await axios.post(url, payload);
                console.log(`✅ SUCCESS with ${version}/${model}!`);
                console.log("Response:", response.data.candidates[0].content.parts[0].text);
                return; // Exit on first success
            } catch (error) {
                console.log(`❌ Failed: ${error.response?.data?.error?.message || error.message}`);
            }
        }
    }
    console.log("\n❌ All combinations failed. There may be a region or billing issue.");
}

testBothVersions();
