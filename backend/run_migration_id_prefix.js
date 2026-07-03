require('dotenv').config();
const { pool } = require('./src/config/db');

async function run() {
    try {
        console.log("Adding id_prefix column to schools table...");
        await pool.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS id_prefix VARCHAR(5);`);
        console.log("Column added successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        pool.end();
    }
}

run();
