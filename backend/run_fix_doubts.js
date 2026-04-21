const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function runSQL() {
    try {
        const sqlPath = path.join(__dirname, 'fix_doubts_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('--- Running SQL ---');
        console.log(sql);

        await pool.query(sql);
        console.log('✅ SQL executed successfully!');
        pool.end();
    } catch (err) {
        console.error('❌ SQL FAILED:', err.message);
        process.exit(1);
    }
}

runSQL();
