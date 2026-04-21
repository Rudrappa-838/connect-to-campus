require('dotenv').config({ path: '../../.env' });
const { pool } = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check for API Key
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is not defined in the environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Parses the CLI arguments.
 */
function getArgs() {
    const args = process.argv.slice(2);
    if (args.length < 5) {
        console.log("Usage: node question_seeder_bot.js <Subject> <ClassLevel> <Chapter> <Topic> <Count>");
        console.log("Example: node question_seeder_bot.js \"Physics\" \"PUC 1\" \"Kinematics\" \"Motion in a Straight Line\" 10");
        process.exit(1);
    }
    return {
        subject: args[0],
        classLevel: args[1],
        chapter: args[2],
        topic: args[3],
        count: parseInt(args[4], 10) || 10
    };
}

/**
 * Builds the prompt for the Gemini AI.
 */
function buildPrompt(subject, classLevel, chapter, topic, targetCount) {
    return `You are an expert ${subject} professor creating exam questions for the NEET/CET/JEE curriculum.
Create exactly ${targetCount} unique Multiple Choice Questions (MCQs) for students at the "${classLevel}" level.
The chapter is "${chapter}" and the specific topic is "${topic}".

STRICT INSTRUCTIONS:
- You must reply ONLY with a completely valid JSON array containing the questions. Do NOT wrap it in Markdown code blocks (like \`\`\`json). Just the raw JSON bracket string.
- The JSON array must contain exactly ${targetCount} objects.
- Each object must have these exact keys: "question", "optionA", "optionB", "optionC", "optionD", "correctOption" (must be "A", "B", "C", or "D"), "briefSolution", "difficulty" ("Easy", "Medium", or "Hard").
- Do not add any extra text before or after the JSON array.`;
}

/**
 * Generates questions using Gemini API.
 */
async function generateQuestions(prompt) {
    console.log("🧠 Sending prompt to Gemini AI...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // Clean up markdown wrapping if the AI accidentally adds it
        text = text.trim();
        if (text.startsWith("```json")) text = text.substring(7);
        if (text.startsWith("```")) text = text.substring(3);
        if (text.endsWith("```")) text = text.substring(0, text.length - 3);

        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
            throw new Error("Received response is not a JSON array.");
        }
        return data;
    } catch (error) {
        console.error("❌ Failed to parse Gemini response or generate content:");
        console.error(error);
        return null;
    }
}

/**
 * Inserts the questions array into PostgreSQL safely.
 */
async function saveToDatabase(questionsData, subject, classLevel, chapter, topic) {
    const client = await pool.connect();
    let inserted = 0;
    try {
        await client.query('BEGIN');
        const insertQuery = `
            INSERT INTO questions (subject, class_level, chapter, topic, question_text, option_a, option_b, option_c, option_d, correct_option, brief_solution, difficulty_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        for (const q of questionsData) {
            await client.query(insertQuery, [
                subject,
                classLevel,
                chapter,
                topic,
                q.question,
                q.optionA,
                q.optionB,
                q.optionC,
                q.optionD,
                q.correctOption,
                q.briefSolution,
                q.difficulty || 'Medium'
            ]);
            inserted++;
        }
        await client.query('COMMIT');
        console.log(`✅ Successfully inserted ${inserted} questions into the database.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Transaction failed, rolled back.", err);
    } finally {
        client.release();
    }
}

/**
 * Main execution function
 */
async function runAutoSeeder() {
    const { subject, classLevel, chapter, topic, count } = getArgs();

    console.log(`🤖 Starting Auto-Seeder: Generating ${count} questions for ${subject} -> ${chapter}...`);

    // We shouldn't request too many at once in a single prompt to avoid token limits or hallucinations.
    // Batch size of 10 or 20 is optimal.
    const batchSize = 10;
    let questionsGenerated = 0;

    while (questionsGenerated < count) {
        const currentBatch = Math.min(batchSize, count - questionsGenerated);
        console.log(`\n⏳ Processing batch of ${currentBatch} questions... (${questionsGenerated}/${count} done)`);

        const prompt = buildPrompt(subject, classLevel, chapter, topic, currentBatch);
        const questionsArray = await generateQuestions(prompt);

        if (questionsArray && questionsArray.length > 0) {
            await saveToDatabase(questionsArray, subject, classLevel, chapter, topic);
            questionsGenerated += questionsArray.length;
        } else {
            console.error("⚠️ Skipping this batch due to errors in generation.");
            // Wait 10 seconds before retrying on failure to avoid rate limit spam
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        // Slight pause between API calls even on success
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n🎉 All done! Auto-Seeder generated and saved a total of ${questionsGenerated} questions.`);
    process.exit(0);
}

runAutoSeeder();
