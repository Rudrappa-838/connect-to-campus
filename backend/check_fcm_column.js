const { pool } = require('./src/config/db');

async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'fcm_token';
        `);
        console.log("🔍 fcm_token Check:", res.rows.length > 0 ? "EXISTS" : "MISSING");
        client.release();
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        pool.end();
    }
}
run();
