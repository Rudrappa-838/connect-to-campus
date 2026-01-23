const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalV7() {
    const client = await pool.connect();
    try {
        console.log('🔧 STARTING FINAL V7 REPAIR (Students Table Core)...');

        // 1. Fix Students Table (Missing columns if table existed from very beginning)
        console.log('👉 Fixing Students...');
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number INTEGER`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_no VARCHAR(50)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS dob DATE`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date DATE`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS vehicle_id INTEGER`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS route_id INTEGER`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS fees_paid DECIMAL(10,2) DEFAULT 0`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS fees_pending DECIMAL(10,2) DEFAULT 0`);

        // 1.1 Fix Teachers Table
        console.log('👉 Fixing Teachers...');
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10, 2) DEFAULT 0`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS transport_route_id INTEGER`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS subject_specialization VARCHAR(100)`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS join_date DATE`);

        // 1.2 Fix Staff Table
        console.log('👉 Fixing Staff...');
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10, 2) DEFAULT 0`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS transport_route_id INTEGER`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS role VARCHAR(50)`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS join_date DATE`);

        // 2. Fix Announcements (Double Check for school_id)
        console.log('👉 Fixing Announcements...');
        await client.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS school_id INTEGER`);

        // 3. Fix Salary (Attendance logic relies on status)
        console.log('👉 Fixing Teacher/Staff Attendance...');
        // Ensure tables exist properly
        await client.query(`CREATE TABLE IF NOT EXISTS teacher_attendance (id SERIAL PRIMARY KEY, school_id INTEGER, teacher_id INTEGER, date DATE, status VARCHAR(20), UNIQUE(teacher_id, date))`);
        await client.query(`CREATE TABLE IF NOT EXISTS staff_attendance (id SERIAL PRIMARY KEY, school_id INTEGER, staff_id INTEGER, date DATE, status VARCHAR(20), UNIQUE(staff_id, date))`);

        console.log('✅ FINAL V7 REPAIR COMPLETE. Students list should load now.');

    } catch (e) {
        console.error('❌ Error in V7 Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalV7();
