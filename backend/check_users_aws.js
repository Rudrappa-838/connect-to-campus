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

async function checkUsers() {
    try {
        const res = await pool.query(`
            SELECT role, count(*) 
            FROM users 
            GROUP BY role
        `);
        console.log('--- USER COUNTS PER ROLE ---');
        res.rows.forEach(row => {
            console.log(`${row.role}: ${row.count}`);
        });

        // Check if there are any teachers in the teachers table but not in users Table (with proper role)
        const tRes = await pool.query(`
            SELECT count(*) FROM teachers t
            LEFT JOIN users u ON LOWER(TRIM(t.email)) = LOWER(TRIM(u.email)) AND u.role = 'TEACHER'
            WHERE u.id IS NULL
        `);
        console.log('Teachers missing in users table (as TEACHER):', tRes.rows[0].count);

        pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
