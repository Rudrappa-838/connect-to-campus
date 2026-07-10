const { pool } = require('./src/config/db');
require('dotenv').config();

async function migrate() {
    try {
        console.log("Starting Migration: Adding competitive exam batch columns...");

        // 1. Add feature flag to schools
        await pool.query(`
            ALTER TABLE schools
            ADD COLUMN IF NOT EXISTS has_exam_batches BOOLEAN DEFAULT FALSE;
        `);
        console.log("✅ Column 'has_exam_batches' added to 'schools'.");

        // 2. Add batch column to students
        await pool.query(`
            ALTER TABLE students
            ADD COLUMN IF NOT EXISTS exam_batch VARCHAR(50);
        `);
        console.log("✅ Column 'exam_batch' added to 'students'.");

        // 3. Add target batch column to exam_events
        await pool.query(`
            ALTER TABLE exam_events
            ADD COLUMN IF NOT EXISTS target_batch VARCHAR(50);
        `);
        console.log("✅ Column 'target_batch' added to 'exam_events'.");

        // Let's enable it for the first school for testing purposes
        await pool.query(`
            UPDATE schools SET has_exam_batches = TRUE WHERE id = 1;
        `);
        console.log("✅ Enabled has_exam_batches for school ID 1.");

    } catch (err) {
        console.error("❌ Migration Failed:", err.message);
    } finally {
        pool.end();
    }
}

migrate();
