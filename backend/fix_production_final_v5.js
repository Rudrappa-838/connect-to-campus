const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalV5() {
    const client = await pool.connect();
    try {
        console.log('🔧 STARTING FINAL V5 REPAIR (Teacher Assignments)...');

        // 1. Fix Sections (Missing class_teacher_id)
        console.log('👉 Fixing Sections...');
        await client.query(`ALTER TABLE sections ADD COLUMN IF NOT EXISTS class_teacher_id INTEGER`);

        // 2. Fix Classes (Missing class_teacher_id)
        console.log('👉 Fixing Classes...');
        await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_id INTEGER`);

        console.log('✅ FINAL V5 REPAIR COMPLETE. Teacher assignments should work now.');

    } catch (e) {
        console.error('❌ Error in V5 Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalV5();
