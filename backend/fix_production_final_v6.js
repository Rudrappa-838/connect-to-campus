const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalV6() {
    const client = await pool.connect();
    try {
        console.log('🔧 STARTING FINAL V6 REPAIR (Grades, Marks, Fees)...');

        // 1. Fix Grades Table (Major Mismatch)
        console.log('👉 Fixing Grades...');
        // Rename grade_name to name if exists, or add name
        await client.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS name VARCHAR(20)`);
        await client.query(`UPDATE grades SET name = grade_name WHERE name IS NULL AND grade_name IS NOT NULL`);

        await client.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS grade_point DECIMAL(4,2) DEFAULT 0`);
        await client.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS exam_type_id INTEGER REFERENCES exam_types(id) ON DELETE CASCADE`);

        // 2. Fix Marks Table (Major Mismatch)
        console.log('👉 Fixing Marks...');
        await client.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS year INTEGER`);
        await client.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS class_id INTEGER`);
        await client.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS section_id INTEGER`);
        await client.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS component_scores JSONB DEFAULT '{}'`);
        await client.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 3. Fix Student Fees (If needed)
        console.log('👉 Fixing Student Fees checks...');
        await client.query(`ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS school_id INTEGER`); // Usually needed for safety

        // 4. Fix Students (Double check transport/hostel links)
        console.log('👉 Fixing Students...');
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS vehicle_id INTEGER`); // Direct vehicle link sometimes used

        console.log('✅ FINAL V6 REPAIR COMPLETE. Marks & Grades should load now.');

    } catch (e) {
        console.error('❌ Error in V6 Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalV6();
