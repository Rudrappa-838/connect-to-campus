const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixLeaves() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing Leaves Schema...');
        await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ Added created_at to leaves table.');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixLeaves();
