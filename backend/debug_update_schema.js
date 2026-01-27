const { Pool } = require('pg');
require('dotenv').config({ path: './.env' }); // Load from root .env

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns(tableName) {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
        `, [tableName]);

        console.log(`\n--- Columns for ${tableName} ---`);
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
        return res.rows.map(r => r.column_name);
    } catch (err) {
        console.error(`Error checking ${tableName}:`, err.message);
        return [];
    }
}

async function run() {
    try {
        console.log("Checking DB Columns for Update Logic...");
        await checkColumns('students');
        await checkColumns('teachers');
        await checkColumns('staff');
    } catch (err) {
        console.error("Global Error:", err);
    } finally {
        pool.end();
    }
}

run();
