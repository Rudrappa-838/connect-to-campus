const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkStaffSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'staff' 
            ORDER BY ordinal_position
        `);

        const cols = result.rows.map(r => r.column_name);
        console.log('Columns in staff table:', cols.join(', '));
        console.log('first_name exists:', cols.includes('first_name'));
        console.log('last_name exists:', cols.includes('last_name'));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkStaffSchema();
