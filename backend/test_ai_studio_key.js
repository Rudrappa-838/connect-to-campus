const { GoogleGenerativeAI } = require("@google/generative-ai");

const key = "AIzaSyBkylqxJcv4dwyAW6_P4cCwIacFrs7Foks";
console.log("Testing AI Studio key:", key.substring(0, 10) + "...\n");

async function test() {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        const result = await model.generateContent("Say hello");
        const response = await result.response;
        console.log("✅ SUCCESS! The key works perfectly!");
        console.log("AI Response:", response.text());
    } catch (error) {
        console.error("❌ FAILED:", error.message);
    }
}

test();
