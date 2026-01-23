const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixSchools() {
    try {
        console.log('🔧 Starting Schools Table Fix...');
        const client = await pool.connect();

        // Add 'is_active' column if missing
        try {
            await client.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`);
            console.log('✅ Added is_active column to schools');
        } catch (e) {
            console.log('⚠️ is_active error:', e.message);
        }

        // Add 'logo' column if missing (also seen mismatch)
        try {
            await client.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo TEXT;`);
            console.log('✅ Added logo column to schools');
        } catch (e) {
            console.log('⚠️ logo error:', e.message);
        }

        // Add 'school_code' column if missing (also seen mismatch)
        try {
            await client.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_code VARCHAR(50);`);
            // Note: making it unique/not null on existing data might fail, so we just add the column for now.
            // If table is empty it's fine.
            console.log('✅ Added school_code column to schools');
        } catch (e) {
            console.log('⚠️ school_code error:', e.message);
        }

        console.log('🎉 Schools Table Updated!');
        client.release();
    } catch (e) {
        console.error('❌ Critical Error:', e);
    } finally {
        pool.end();
    }
}

fixSchools();
