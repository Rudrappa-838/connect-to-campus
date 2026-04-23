
const { pool } = require('./src/config/db');

async function fixSchema() {
    const client = await pool.connect();
    try {
        console.log("Checking schema for biometric permissions...");
        
        // Teachers
        await client.query(`
            ALTER TABLE teachers 
            ADD COLUMN IF NOT EXISTS can_enroll_face BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS can_take_face_attendance BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS biometric_template JSONB
        `);
        console.log("Teachers table updated.");

        // Staff
        await client.query(`
            ALTER TABLE staff 
            ADD COLUMN IF NOT EXISTS can_enroll_face BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS can_take_face_attendance BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS biometric_template JSONB
        `);
        console.log("Staff table updated.");

        // Attendance tables for biometric marking
        await client.query(`
            CREATE TABLE IF NOT EXISTS teacher_attendance (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id),
                teacher_id INTEGER REFERENCES teachers(id),
                date DATE DEFAULT CURRENT_DATE,
                status VARCHAR(50) DEFAULT 'Present',
                marking_mode VARCHAR(50) DEFAULT 'manual',
                UNIQUE(teacher_id, date)
            )
        `);
        console.log("teacher_attendance table verified.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS staff_attendance (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id),
                staff_id INTEGER REFERENCES staff(id),
                date DATE DEFAULT CURRENT_DATE,
                status VARCHAR(50) DEFAULT 'Present',
                marking_mode VARCHAR(50) DEFAULT 'manual',
                UNIQUE(staff_id, date)
            )
        `);
        console.log("staff_attendance table verified.");

        console.log("Schema fix completed.");
    } catch (err) {
        console.error("Schema fix failed:", err);
    } finally {
        client.release();
        process.exit();
    }
}

fixSchema();
