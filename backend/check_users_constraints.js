const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkConstraints() {
    try {
        const res = await pool.query(`
            SELECT 
                conname as constraint_name, 
                pg_get_constraintdef(c.oid) as constraint_definition
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE contype IN ('u', 'p') 
            AND conrelid = 'users'::regclass;
        `);
        console.log('Constraints on users table:');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkConstraints();
