const { Pool } = require('pg');
require('dotenv').config();

async function checkStudentsTable() {
    const url = process.env.PROD_DATABASE_URL;
    if (!url) return;
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'students'");
        console.log('Columns in students table (PROD):');
        console.log(res.rows.map(r => r.column_name));
    } catch (error) {
        console.error('Error listing student columns:', error.message);
    } finally {
        await pool.end();
    }
}

checkStudentsTable();
