const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function checkDDL() {
    try {
        const res = await pool.query(`
            SELECT column_name, column_default, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'doubts'
        `);
        console.log('--- DOUBTS TABLE DDL ---');
        res.rows.forEach(row => {
            console.log(`${row.column_name}: default=${row.column_default}, nullable=${row.is_nullable}`);
        });
        pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDDL();
