const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function addTeacherNameCols() {
    try {
        console.log('Checking teachers table for name columns...');

        await pool.query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)');
        await pool.query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)');

        console.log('Columns added successfully.');

        // Optional: Backfill existing names?
        const res = await pool.query('SELECT id, name FROM teachers WHERE first_name IS NULL');
        for (const row of res.rows) {
            const parts = row.name.trim().split(' ');
            const first = parts[0];
            const last = parts.slice(1).join(' ');
            await pool.query('UPDATE teachers SET first_name = $1, last_name = $2 WHERE id = $3', [first, last, row.id]);
        }
        console.log(`Backfilled ${res.rows.length} teachers.`);

    } catch (err) {
        console.error('Error adding columns:', err);
    } finally {
        await pool.end();
    }
}

addTeacherNameCols();
