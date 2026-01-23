const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalV4() {
    const client = await pool.connect();
    try {
        console.log('🔧 STARTING FINAL V4 REPAIR (Exam Schedules)...');

        // 1. Fix Exam Schedules (Missing min_marks, max_marks, components, deleted_at)
        console.log('👉 Fixing Exam Schedules...');
        await client.query(`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS min_marks DECIMAL(5,2) DEFAULT 35`);
        await client.query(`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS max_marks DECIMAL(5,2) DEFAULT 100`);
        await client.query(`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);

        // 2. Fix Exam Types (Double check)
        console.log('👉 Fixing Exam Types...');
        await client.query(`ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS min_marks INTEGER DEFAULT 35`);
        await client.query(`ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS start_month INTEGER DEFAULT 1`);
        await client.query(`ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS end_month INTEGER DEFAULT 12`);

        // 3. Fix Transport Vehicles (Double Check)
        console.log('👉 Fixing Transport Vehicles...');
        await client.query(`ALTER TABLE transport_vehicles ADD COLUMN IF NOT EXISTS driver_id INTEGER`);
        await client.query(`ALTER TABLE transport_vehicles ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100)`);
        await client.query(`ALTER TABLE transport_vehicles ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active'`);

        console.log('✅ FINAL V4 REPAIR COMPLETE. Exam Schedules patched.');

    } catch (e) {
        console.error('❌ Error in V4 Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalV4();
