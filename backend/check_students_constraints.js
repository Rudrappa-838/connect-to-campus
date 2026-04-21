const { Pool } = require('pg');
require('dotenv').config();

async function checkConstraints() {
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`
            SELECT 
                conname AS constraint_name, 
                contype AS constraint_type,
                pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE n.nspname = 'public' AND conrelid = 'students'::regclass;
        `);
        console.log('Constraints on students table:');
        res.rows.forEach(r => console.log(`- ${r.constraint_name} (${r.constraint_type}): ${r.definition}`));
    } catch (error) {
        console.error('Error listing constraints:', error.message);
    } finally {
        await pool.end();
    }
}

checkConstraints();
