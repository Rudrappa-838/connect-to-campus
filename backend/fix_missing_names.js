const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixMissingNames() {
    const client = await pool.connect();
    try {
        console.log('🏗️ Starting COMPREHENSIVE NAME COLUMN FIX...');
        await client.query('BEGIN');

        // 1. Fix Students Table
        console.log('🔄 Checking students table...');
        await client.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
        // Populate name if empty, preferring concatenated First+Last, then just First, then 'Student'
        await client.query(`
            UPDATE students 
            SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
            WHERE name IS NULL OR name = ''
        `);
        console.log('   ✅ Students "name" column verified and populated.');

        // 2. Fix Teachers Table
        console.log('🔄 Checking teachers table...');
        await client.query('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
        // Teachers might not have first_name/last_name split in some versions, but if they do:
        // If not, we rely on what's there. If purely missing, set a Placeholder.
        await client.query(`
            UPDATE teachers 
            SET name = COALESCE(email, 'Teacher User') 
            WHERE name IS NULL OR name = ''
        `);
        console.log('   ✅ Teachers "name" column verified.');

        // 3. Fix Staff Table
        console.log('🔄 Checking staff table...');
        await client.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
        await client.query(`
            UPDATE staff 
            SET name = COALESCE(email, 'Staff User') 
            WHERE name IS NULL OR name = ''
        `);
        console.log('   ✅ Staff "name" column verified.');

        // 4. Fix Events/Calendar (often crashes if audience is missing)
        await client.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS audience VARCHAR(50) DEFAULT \'All\'');

        // 5. Fix Leaves (often crashes if role/status missing)
        await client.query("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Student'");

        await client.query('COMMIT');
        console.log('🎉 ALL NAME COLUMNS & CRITICAL FIELDS FIXED!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing names:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixMissingNames();
