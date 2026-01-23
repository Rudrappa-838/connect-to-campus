const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalV3() {
    const client = await pool.connect();
    try {
        console.log('🔧 STARTING FINAL V3 REPAIR (Exams & Transport)...');

        // 1. Fix Exam Types (Missing min_marks, months)
        console.log('👉 Fixing Exam Types...');
        await client.query(`ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS min_marks INTEGER DEFAULT 35`);
        await client.query(`ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS start_month INTEGER DEFAULT 1`);
        await client.query(`ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS end_month INTEGER DEFAULT 12`);

        // 2. Fix Transport Vehicles (Missing driver_id for linking)
        console.log('👉 Fixing Transport Vehicles...');
        await client.query(`ALTER TABLE transport_vehicles ADD COLUMN IF NOT EXISTS driver_id INTEGER`);
        await client.query(`ALTER TABLE transport_vehicles ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100)`);
        await client.query(`ALTER TABLE transport_vehicles ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active'`);

        // 3. Fix Expenditures (Double Check)
        console.log('👉 Fixing Expenditures...');
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS created_by INTEGER`);

        // 4. Fix Transport Routes (Double Check)
        console.log('👉 Fixing Transport Routes...');
        await client.query(`ALTER TABLE transport_routes ADD COLUMN IF NOT EXISTS vehicle_id INTEGER`);

        // 5. Fix Teachers (Double Check)
        console.log('👉 Fixing Teachers...');
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10,2) DEFAULT 0`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)`);

        console.log('✅ FINAL V3 REPAIR COMPLETE. All modules should work now.');

    } catch (e) {
        console.error('❌ Error in V3 Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalV3();
