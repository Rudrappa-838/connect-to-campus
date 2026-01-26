const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixSchoolsStatus() {
    try {
        console.log('🔧 Adding status column to schools...');
        const client = await pool.connect();

        try {
            // Add 'status' column (Required for Soft Deletes)
            await client.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';`);
            console.log('✅ Added status column to schools');
        } catch (e) {
            console.log('⚠️ status column error:', e.message);
        }

        console.log('🎉 Fixed Schools Table!');
        client.release();
    } catch (e) {
        console.error('❌ Critical Error:', e);
    } finally {
        pool.end();
    }
}

fixSchoolsStatus();
