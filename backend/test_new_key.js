const { GoogleGenerativeAI } = require("@google/generative-ai");

const key = "AIzaSyBsM4cM476OsjngNWQYOGMDhlQyWwuIaSU";
console.log("Testing new key:", key.substring(0, 10) + "...\n");

async function test() {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        const result = await model.generateContent("Say hello in one sentence");
        const response = await result.response;
        console.log("✅ SUCCESS! Key is working!");
        console.log("Response:", response.text());
    } catch (error) {
        console.error("❌ FAILED:", error.message);
    }
}

test();
