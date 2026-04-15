const { pool } = require('./src/config/db');
require('dotenv').config();

async function migrate() {
    try {
        console.log("Starting Migration: Adding feature toggle columns to 'schools' table...");
        
        await pool.query(`
            ALTER TABLE schools 
            ADD COLUMN IF NOT EXISTS has_neet_exams BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_face_enrollment BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_face_scanner BOOLEAN DEFAULT FALSE;
        `);

        console.log("✅ Migration Successful: Columns added.");
        
        const res = await pool.query("SELECT id, name, has_hostel, has_neet_exams, has_face_enrollment, has_face_scanner FROM schools LIMIT 1");
        console.table(res.rows);

    } catch (err) {
        console.error("❌ Migration Failed:", err.message);
    } finally {
        pool.end();
    }
}

migrate();
