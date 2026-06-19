const { pool } = require('./src/config/db');
require('dotenv').config();

async function migrate() {
    try {
        console.log("Starting Migration: Adding missing feature toggle columns to 'schools' table...");

        await pool.query(`
            ALTER TABLE schools
            ADD COLUMN IF NOT EXISTS has_biometric BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_subject_combinations BOOLEAN DEFAULT FALSE;
        `);

        console.log("✅ Migration Successful: Columns 'has_biometric' and 'has_subject_combinations' added.");

        const res = await pool.query(`
            SELECT id, name, has_hostel, has_neet_exams, has_face_enrollment, has_face_scanner, has_biometric, has_subject_combinations
            FROM schools LIMIT 5
        `);
        console.table(res.rows);

    } catch (err) {
        console.error("❌ Migration Failed:", err.message);
    } finally {
        pool.end();
    }
}

migrate();
