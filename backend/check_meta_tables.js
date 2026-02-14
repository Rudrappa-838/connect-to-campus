const { Pool } = require('pg');
require('dotenv').config();

async function checkSchema() {
    const url = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const classes = await pool.query("SELECT id, name FROM classes");
        console.log('Classes in DB:', classes.rows);
        const sections = await pool.query("SELECT id, name, class_id FROM sections");
        console.log('Sections in DB:', sections.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
checkSchema();
