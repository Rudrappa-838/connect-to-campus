
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { pool } = require('../config/db');

// Initialize Gemini API Helper
const getGeminiModel = async (schoolId, modelName = "gemini-1.5-flash") => {
    let apiKey = process.env.GEMINI_API_KEY;

    if (schoolId) {
        try {
            const res = await pool.query('SELECT gemini_api_key FROM schools WHERE id = $1', [schoolId]);
            if (res.rows.length > 0 && res.rows[0].gemini_api_key) {
                apiKey = res.rows[0].gemini_api_key;
            }
        } catch (e) {
            console.error('Error fetching school API key:', e);
        }
    }

    if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in School Settings.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelName });
};

// Mock Paper Generator (Fallback when API is unavailable)
function generateMockPaper(prompt, subject, class_level) {
    const lowerPrompt = (prompt || '').toLowerCase();
    subject = subject || 'General';
    class_level = class_level || 'Class 10';

    // Parse prompt for question counts
    const mcqMatch = lowerPrompt.match(/(\d+)\s*(mcq|multiple\s*choice)/i);
    const shortMatch = lowerPrompt.match(/(\d+)\s*(short|brief)/i);
    const longMatch = lowerPrompt.match(/(\d+)\s*(long|detailed|word\s*problem)/i);

    const mcqCount = mcqMatch ? parseInt(mcqMatch[1]) : 5;
    const shortCount = shortMatch ? parseInt(shortMatch[1]) : 3;
    const longCount = longMatch ? parseInt(longMatch[1]) : 2;

    const sections = [];

    // Section A: MCQs
    if (mcqCount > 0) {
        const mcqs = [];
        for (let i = 1; i <= mcqCount; i++) {
            mcqs.push({
                id: i,
                text: `Sample MCQ ${i} for ${subject}`,
                options: ["Option A", "Option B", "Option C", "Option D"],
                answer: "A",
                marks: 1
            });
        }
        sections.push({
            name: "Section A: Multiple Choice Questions",
            questions: mcqs
        });
    }

    // Section B: Short Answers
    if (shortCount > 0) {
        const shorts = [];
        for (let i = 1; i <= shortCount; i++) {
            shorts.push({
                id: mcqCount + i,
                text: `Sample Short Answer Question ${i} for ${subject}`,
                answer: "Brief explanation expected",
                marks: 2
            });
        }
        sections.push({
            name: "Section B: Short Answer Questions",
            questions: shorts
        });
    }

    // Section C: Long Answers
    if (longCount > 0) {
        const longs = [];
        for (let i = 1; i <= longCount; i++) {
            longs.push({
                id: mcqCount + shortCount + i,
                text: `Sample Long Answer Question ${i} for ${subject}`,
                answer: "Detailed explanation expected",
                marks: 5
            });
        }
        sections.push({
            name: "Section C: Long Answer Questions",
            questions: longs
        });
    }

    return {
        title: `${subject} Test - ${class_level} (Demo Mode)`,
        instructions: [
            "⚠️ DEMO MODE: This is a sample paper generated without AI",
            "Add Google Cloud billing to enable real AI generation",
            "Time: 1 hour",
            `Total Questions: ${mcqCount + shortCount + longCount}`
        ],
        sections
    };
}

// 1. Generate Questions from Image/Text (Legacy/Existing Route)
exports.generateQuestions = async (req, res) => {
    try {
        const { prompt } = req.body;
        const schoolId = req.user.schoolId;
        const files = req.files || [];

        const model = await getGeminiModel(schoolId);

        let parts = [];
        if (prompt) parts.push(prompt);

        // Convert images to Gemini format
        for (const file of files) {
            parts.push({
                inlineData: {
                    data: file.buffer.toString("base64"),
                    mimeType: file.mimetype,
                },
            });
        }

        if (parts.length === 0) {
            return res.status(400).json({ error: "Prompt or Image is required" });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        res.json({ text });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI content" });
    }
};

// 2. Generate Full Question Paper (New Requirement)
exports.generateQuestionPaper = async (req, res) => {
    const { prompt, subject, class_level } = req.body;
    const schoolId = req.user.schoolId;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const model = await getGeminiModel(schoolId);

        const systemInstruction = `
        You are an expert teacher helping to create a school exam paper.
        
        Task: Generate a structured question paper based on the user's request.
        Subject: ${subject || 'General'}
        Class: ${class_level || 'General'}
        
        Strict Output Format (JSON ONLY):
        {
            "title": "Exam Title",
            "instructions": ["Time: 1 hr", "max marks: 20", ...],
            "sections": [
                {
                    "name": "Section A: Multiple Choice",
                    "questions": [
                        { "id": 1, "text": "Question text?", "options": ["A", "B", "C", "D"], "answer": "A", "marks": 1 }
                    ]
                },
                {
                    "name": "Section B: Short Answer",
                    "questions": [
                        { "id": 2, "text": "Question text?", "answer": "Key points...", "marks": 2 }
                    ]
                }
            ]
        }
        
        Do NOT wrap in markdown code blocks. Just return raw JSON.
        `;

        // Concatenate for gemini-pro (safer than array parts for instruction)
        const finalPrompt = `${systemInstruction}\n\nUser Request: ${prompt}`;
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        let text = response.text();

        // Remove markdown formatting
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Extract JSON object if there's extra text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const json = JSON.parse(text);
        res.json(json);

    } catch (error) {
        console.error('AI Paper Generation Error:', error);

        // FALLBACK: Generate mock paper based on prompt
        console.log('Using mock AI fallback mode...');

        try {
            const mockPaper = generateMockPaper(prompt, subject, class_level);
            console.log('Mock paper generated successfully');
            return res.json(mockPaper);
        } catch (mockError) {
            console.error('Mock generation also failed:', mockError);
        }

        let errorMessage = 'Failed to generate paper.';
        if (error.message && (error.message.includes('404') || error.message.includes('not found') || error.message.includes('permission'))) {
            errorMessage = 'AI Model not found or API Key not authorized. Please enable "Generative Language API" in Google Cloud Console or get a new key from https://aistudio.google.com/app/apikey';
        } else if (error.message) {
            errorMessage += ' ' + error.message;
        }


        res.status(500).json({
            error: errorMessage,
            details: error.toString()
        });
    }
};
