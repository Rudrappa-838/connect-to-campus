const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const candidateModels = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "models/gemini-2.0-flash", // Try with prefix
    "models/gemini-1.5-flash"
];

async function test() {
    console.log("🔑 Testing with Key:", API_KEY ? "Present" : "Missing");

    for (const modelName of candidateModels) {
        console.log(`\n🤖 Testing Model: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello, this is a test.");
            const response = await result.response;
            const text = response.text();
            console.log(`✅ SUCCESS! Response: ${text}`);
            return; // Exit on first success
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }
    }
    console.log("\n⚠️ All models failed.");
}

test();
