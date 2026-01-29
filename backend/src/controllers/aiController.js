const { GoogleGenerativeAI } = require("@google/generative-ai");
const { pool } = require('../config/db'); // Import DB pool

// Helper: Format AI response into clean JSON
const cleanAIResponse = (text) => {
    try {
        console.log("--- Raw AI Response ---");
        console.log(text);
        console.log("-----------------------");

        // Remove Markdown code blocks
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Find the first '[' and last ']' to extract just the array
        const firstBracket = clean.indexOf('[');
        const lastBracket = clean.lastIndexOf(']');

        if (firstBracket !== -1 && lastBracket !== -1) {
            clean = clean.substring(firstBracket, lastBracket + 1);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.error("AI JSON Parse Error:", e);
        return null;
    }
};

const generateQuestions = async (req, res) => {
    try {
        const { topic, subject, classLevel, difficulty, questionCount, type, apiKey } = req.body;
        const schoolId = req.user.schoolId;

        // 1. Priority: User Provided Key (Frontend Test)
        let keyToUse = apiKey;

        // 2. Priority: School Specific Key (BYOK)
        if (!keyToUse && schoolId) {
            try {
                const schoolRes = await pool.query('SELECT gemini_api_key FROM schools WHERE id = $1', [schoolId]);
                if (schoolRes.rows.length > 0 && schoolRes.rows[0].gemini_api_key) {
                    keyToUse = schoolRes.rows[0].gemini_api_key;
                    console.log(`🤖 Using School-Specific API Key for School ID: ${schoolId}`);
                }
            } catch (err) {
                console.error("Error fetching school api key:", err);
            }
        }

        // 3. Priority: Global Env Key (Super Admin Fallback)
        if (!keyToUse) {
            keyToUse = process.env.GEMINI_API_KEY;
            console.log("🤖 Using Global Fallback API Key");
        }

        if (!keyToUse) {
            return res.status(400).json({
                message: "No AI API Key found. Please set it in School Settings or Contact Admin.",
                missingKey: true
            });
        }

        const genAI = new GoogleGenerativeAI(keyToUse);

        // Prepare Image Parts if files exist
        let imageParts = [];
        if (req.files && req.files.length > 0) {
            imageParts = req.files.map(file => ({
                inlineData: {
                    data: file.buffer.toString("base64"),
                    mimeType: file.mimetype,
                },
            }));
        }

        const isImageMode = imageParts.length > 0;

        // Construct Prompt
        let promptText;
        if (isImageMode) {
            // Image-based prompt (Same as before)
            promptText = `You are an expert academic teacher creating an exam question paper.
CRITICAL INSTRUCTIONS FOR IMAGE-BASED GENERATION:
1. CAREFULLY READ AND ANALYZE the text, diagrams, formulas, and content in the provided image(s)
2. ONLY generate questions about the SPECIFIC topics, concepts, facts, and information visible in the image
3. DO NOT add questions about general knowledge or topics not shown in the image
4. Extract key terms, definitions, formulas, dates, names, and concepts DIRECTLY from the image
5. Questions must test understanding of the EXACT content shown in the image

Paper Specifications:
- Subject: ${subject || 'Based on image content'}
- Class Level: ${classLevel || 'Grade 10'}
- Difficulty: ${difficulty}
- Number of Questions: ${questionCount}
- Question Type: ${type} (If 'mixed', include MCQ, FillInBlanks, MatchTheFollowing, and Descriptive)

OUTPUT FORMAT:
Strictly output a JSON array of objects. Do not include any extra text or explanations.
Each object must have:
- "id": unique number (start from 1)
- "type": "MCQ" | "Descriptive" | "FillInBlanks" | "MatchTheFollowing"
- "question": Question text based ONLY on image content
- "marks": recommended marks
- "answer": The correct answer

Type-Specific Fields:
1. MCQ: "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Correct option text"
2. FillInBlanks: "question": "Text with ______ for blank", "answer": "Correct word/phrase"
3. MatchTheFollowing: "question": "Match the following", "pairs": [{"left": "Item", "right": "Match"}] (4 pairs), "answer": "Brief summary"

Example JSON:
[
    { "id": 1, "type": "MCQ", "question": "...", "options": ["A", "B", "C", "D"], "marks": 1, "answer": "A" },
    { "id": 2, "type": "Descriptive", "question": "...", "marks": 5, "answer": "..." }
]`;
        } else {
            // Topic-based prompt (Same as before)
            promptText = `You are an expert academic teacher. Generate a question paper with the following specifications:
        - Subject: ${subject || 'General'}
        - Class Level: ${classLevel || 'Grade 10'}
        - Topic: ${topic || 'General'}
        - Difficulty: ${difficulty}
        - Number of Questions: ${questionCount}
        - Question Type: ${type} 
        
        CRITICAL INSTRUCTION: 
        If the 'Topic' contains specific instructions about question types (e.g., "5 MCQ", "choice questions", "fill in blanks"), YOU MUST FOLLOW THOSE INSTRUCTIONS over the general 'Question Type' setting.
        - "choice" or "MCQ" -> Generate Multiple Choice Questions.
        - "blanks" -> Generate Fill in the Blanks.
        - "match" -> Generate Match the Following.
        - "write" or "explain" -> Generate Descriptive.

        If 'Question Type' is 'mixed' and the topic has no specific instructions, generate a balanced mix of MCQ, FillInBlanks, MatchTheFollowing, and Descriptive.

        Strictly output a JSON array of objects. Do not include any extra text.
        Each object should have:
        - "id": a unique number (start from 1)
        - "type": "MCQ" | "Descriptive" | "FillInBlanks" | "MatchTheFollowing"
        - "question": The question text
        - "marks": recommended marks
        - "answer": The correct answer (for Teacher's reference)
        
        Specific Fields per Type:
        1. MCQ:
           - "options": ["A", "B", "C", "D"]
           - "answer": "Option Text"
        2. FillInBlanks:
           - "question": "The capital of France is ______." (Use underscores for blank)
           - "answer": "Paris"
        3. MatchTheFollowing:
           - "question": "Match the following items correctly"
           - "pairs": [ {"left": "Item A", "right": "Match A"}, {"left": "Item B", "right": "Match B"} ] (Provide 4 pairs)
           - "answer": "A-1, B-2..." (Brief summary of matches)

        Example JSON format:
        [
            { "id": 1, "type": "MCQ", "question": "...", "options": ["A", "B", "C", "D"], "marks": 1, "answer": "A" },
            { "id": 2, "type": "FillInBlanks", "question": "The sun rises in the ______.", "marks": 1, "answer": "East" },
            { "id": 3, "type": "MatchTheFollowing", "question": "Match the following", "pairs": [{"left":"A","right":"B"}], "marks": 4, "answer": "A-B..." }
        ]`;
        }

        // Define models to try in order (Prioritizing available models)
        const candidateModels = [
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-2.0-flash-001",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002"
        ];

        // Add legacy models if strict 1.5 fails? 
        // Note: gemini-pro-vision is needed for images if using legacy, gemini-pro for text.
        if (isImageMode) {
            candidateModels.push("gemini-pro-vision");
        } else {
            candidateModels.push("gemini-pro");
        }

        let finalResult = null;
        let lastError = null;

        // Try models sequentially
        for (const modelName of candidateModels) {
            try {
                console.log(`🤖 Attempting generation with model: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent([promptText, ...imageParts]);
                const response = await result.response;
                finalResult = response.text();

                console.log(`✅ Success with model: ${modelName}`);
                break; // Stop if success
            } catch (err) {
                console.warn(`⚠️ Failed with model ${modelName}:`, err.message);
                lastError = err;
            }
        }

        if (!finalResult) {
            if (lastError && (lastError.message.includes('429') || lastError.message.includes('Too Many Requests'))) {
                throw new Error("AI Rate Limit Exceeded. Please wait 1 minute and try again.");
            }
            throw lastError || new Error("All models failed to generate content.");
        }

        const questions = cleanAIResponse(finalResult);

        if (!questions) {
            return res.status(500).json({ message: "AI generated invalid format. Check console logs." });
        }

        res.json({ questions });

    } catch (error) {
        console.error("AI Generation Error:", error);

        // Check if it's a model not found error
        if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
            return res.status(500).json({
                message: "AI Model Not Available. Your key may have restrictions. Tried: gemini-1.5-flash, gemini-1.5-pro, gemini-pro. Error: " + error.message,
                error: "Model not available"
            });
        }

        res.status(500).json({ message: "Failed: " + (error.message || "Unknown error") });
    }
};

module.exports = { generateQuestions };
