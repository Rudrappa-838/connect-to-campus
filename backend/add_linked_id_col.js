const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function addLinkedIdColumn() {
    try {
        console.log('Checking users table for linked_id column...');

        // Check if column exists
        const check = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'linked_id'
        `);

        if (check.rows.length === 0) {
            console.log('linked_id column missing. Adding it now...');
            await pool.query('ALTER TABLE users ADD COLUMN linked_id INTEGER DEFAULT NULL');
            console.log('linked_id column added successfully.');
        } else {
            console.log('linked_id column already exists.');
        }

    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await pool.end();
    }
}

addLinkedIdColumn();
