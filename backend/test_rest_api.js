const axios = require('axios');

const key = "AIzaSyBkylqxJcv4dwyAW6_P4cCwIacFrs7Foks";
console.log("Testing with REST API:", key.substring(0, 10) + "...\n");

async function testRestAPI() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

    const payload = {
        contents: [{
            parts: [{
                text: "Say hello"
            }]
        }]
    };

    try {
        const response = await axios.post(url, payload);
        console.log("✅ SUCCESS! The API key works!");
        console.log("Response:", response.data.candidates[0].content.parts[0].text);
    } catch (error) {
        console.error("❌ FAILED:", error.response?.data || error.message);
    }
}

testRestAPI();
