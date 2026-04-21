const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function relaxConstraint() {
    try {
        console.log('Dropping unique email constraint on users table...');

        // 1. Drop existing unique constraint
        await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key');

        // 2. Optionally add a composite unique constraint (email, role)
        // This allows same email for DIFFERENT roles, but prevents same email for SAME role.
        // If the user truly wants NO constraints, we could skip this.
        // But (email, role) is usually what "allow same email for different roles" means.
        await pool.query('ALTER TABLE users ADD CONSTRAINT users_email_role_key UNIQUE (email, role)');

        console.log('Constraint relaxed successfully: Now unique on (email, role).');
    } catch (err) {
        console.error('Error relaxing constraint:', err);
    } finally {
        await pool.end();
    }
}

relaxConstraint();
