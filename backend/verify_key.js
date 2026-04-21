const { GoogleGenerativeAI } = require("@google/generative-ai");

const key = "AIzaSyA38a7jt8IbEe3IgU6u9FPMHNK6zVq-VQY";
console.log("Testing Key:", key.substring(0, 10) + "...\n");

const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro", "gemini-2.0-flash-exp"];

async function testModels() {
    const genAI = new GoogleGenerativeAI(key);

    for (const modelName of models) {
        try {
            console.log(`Trying ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Say hi");
            const response = await result.response;
            console.log(`✅ SUCCESS with ${modelName}!`);
            console.log(`Response: ${response.text()}\n`);
            return; // Exit on first success
        } catch (error) {
            console.log(`❌ Failed: ${error.message.substring(0, 100)}...\n`);
        }
    }
    console.log("All models failed. Please check API key configuration.");
}

testModels();
