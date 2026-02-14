const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runFixes() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Master Database Fix for AWS...');

        await client.query('BEGIN');

        // 1. Fix Users Table (linked_id and relaxed constraint)
        console.log('--- Updating users table ---');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_id INTEGER DEFAULT NULL');
        await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key');
        // Check if composite unique constraint already exists before adding
        const constraintCheck = await client.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'users' AND constraint_name = 'users_email_role_key'
        `);
        if (constraintCheck.rows.length === 0) {
            await client.query('ALTER TABLE users ADD CONSTRAINT users_email_role_key UNIQUE (email, role)');
            console.log('✅ Composite unique constraint (email, role) added.');
        } else {
            console.log('ℹ️ Composite unique constraint already exists.');
        }

        // 2. Fix Students Table (first_name, last_name, etc.)
        console.log('--- Updating students table ---');
        const studentCols = [
            "first_name VARCHAR(100)", "last_name VARCHAR(100)", "father_name VARCHAR(100)", "mother_name VARCHAR(100)",
            "phone VARCHAR(50)", "contact_number VARCHAR(50)", "dob DATE", "gender VARCHAR(20)", "address TEXT",
            "roll_number INTEGER", "section_id INTEGER", "attendance_id VARCHAR(50)", "admission_date DATE"
        ];
        for (const col of studentCols) {
            const colName = col.split(' ')[0];
            await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS ${col}`);
        }
        console.log('✅ Students table columns verified.');

        // 3. Fix Teachers Table
        console.log('--- Updating teachers table ---');
        const teacherCols = [
            "first_name VARCHAR(100)", "last_name VARCHAR(100)", "phone VARCHAR(50)", "subject_specialization VARCHAR(255)",
            "employee_id VARCHAR(50)", "salary_per_day DECIMAL(10, 2) DEFAULT 0", "gender VARCHAR(10)", "join_date DATE", "address TEXT"
        ];
        for (const col of teacherCols) {
            await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS ${col}`);
        }
        console.log('✅ Teachers table columns verified.');

        // 4. Fix Staff Table
        console.log('--- Updating staff table ---');
        const staffCols = [
            "first_name VARCHAR(100)", "last_name VARCHAR(100)", "phone VARCHAR(50)", "employee_id VARCHAR(50)",
            "salary_per_day DECIMAL(10, 2) DEFAULT 0", "gender VARCHAR(10)", "join_date DATE", "address TEXT"
        ];
        for (const col of staffCols) {
            await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS ${col}`);
        }
        console.log('✅ Staff table columns verified.');

        await client.query('COMMIT');
        console.log('✨ ALL DATABASE FIXES APPLIED SUCCESSFULLY!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ DATABASE FIX FAILED:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runFixes();
