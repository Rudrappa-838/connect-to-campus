const { pool } = require('./src/config/db');

async function checkConstraints() {
    try {
        console.log('Checking constraints on users table...');
        const res = await pool.query(`
            SELECT
                conname as constraint_name,
                pg_get_constraintdef(c.oid) as constraint_definition
            FROM
                pg_constraint c
            JOIN
                pg_class t ON t.oid = c.conrelid
            WHERE
                t.relname = 'users';
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkConstraints();
