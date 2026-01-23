const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixStudentName() {
    const client = await pool.connect();
    try {
        console.log('🔄 Checking students table for "name" column...');

        // 1. Check if name column exists
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='students' AND column_name='name'
        `);

        if (res.rows.length === 0) {
            console.log('⚠️ Column "name" is MISSING. Adding it now...');
            await client.query('BEGIN');

            // Add column
            await client.query('ALTER TABLE students ADD COLUMN name VARCHAR(150)');

            // Populate it from first/last name
            await client.query(`
                UPDATE students 
                SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
                WHERE name IS NULL
            `);

            await client.query('COMMIT');
            console.log('✅ Column "name" added and populated successfully!');
        } else {
            console.log('✅ Column "name" already exists.');
        }

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing student name column:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixStudentName();
