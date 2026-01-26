const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixAllMissingColumns() {
    const client = await pool.connect();
    try {
        console.log('🔧 STARTING MASTER COLUMN REPAIR...');

        // 1. Expenditures
        console.log('👉 Fixing Expenditures...');
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS created_by INTEGER`);

        // 2. Library
        console.log('👉 Fixing Library...');
        await client.query(`ALTER TABLE library_books ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 3. Leaves
        console.log('👉 Fixing Leaves...');
        await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 4. Announcements
        console.log('👉 Fixing Announcements...');
        await client.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await client.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by INTEGER`);

        // 5. Notifications
        console.log('👉 Fixing Notifications...');
        await client.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        console.log('✅ MASTER REPAIR COMPLETE. All missing columns added.');

    } catch (e) {
        console.error('❌ Error in Master Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixAllMissingColumns();
