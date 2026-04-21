const { pool } = require('./src/config/db');

async function run() {
    try {
        console.log("🔌 Connecting to DB...");
        const client = await pool.connect();

        console.log("🛠️ Adding gemini_api_key column to schools table...");

        await client.query(`
            ALTER TABLE schools 
            ADD COLUMN IF NOT EXISTS gemini_api_key TEXT DEFAULT NULL;
        `);

        console.log("✅ Column added successfully!");

        // Verification
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'schools' AND column_name = 'gemini_api_key';
        `);

        console.log("🔍 Verification:", res.rows[0]);

        client.release();
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        pool.end();
    }
}

run();
