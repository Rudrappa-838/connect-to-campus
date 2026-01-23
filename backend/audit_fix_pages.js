const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixHiddenPages() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting PAGE-SPECIFIC SCHEMA FIXES...');
        await client.query('BEGIN');

        // ===============================================
        // 1. TIMETABLE & SUBJECTS
        // ===============================================
        console.log('🔧 Fixing Timetable & Subjects...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                class_id INTEGER,
                name VARCHAR(100),
                code VARCHAR(20),
                type VARCHAR(20) DEFAULT 'Theory'
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS timetables (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                class_id INTEGER,
                section_id INTEGER,
                day_of_week INTEGER, -- 1=Mon, 6=Sat
                period_number INTEGER,
                subject_id INTEGER,
                teacher_id INTEGER,
                start_time VARCHAR(20),
                end_time VARCHAR(20),
                room_number VARCHAR(20)
            );
        `);

        // ===============================================
        // 2. EXAM SCHEDULES
        // ===============================================
        console.log('🔧 Fixing Exam Schedules...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS exam_schedules (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                exam_type_id INTEGER,
                class_id INTEGER,
                section_id INTEGER,
                subject_id INTEGER,
                exam_date DATE,
                start_time VARCHAR(20),
                end_time VARCHAR(20),
                max_marks DECIMAL(5,2) DEFAULT 100,
                min_marks DECIMAL(5,2) DEFAULT 35
            );
        `);
        await client.query(`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);

        // ===============================================
        // 3. CERTIFICATES
        // ===============================================
        console.log('🔧 Fixing Certificates...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_certificates (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                student_id INTEGER,
                certificate_type VARCHAR(50),
                certificate_no VARCHAR(50),
                issue_date DATE DEFAULT CURRENT_DATE,
                remarks TEXT,
                file_path TEXT
            );
        `);

        // ===============================================
        // 4. ATTENDANCE (For Salary Calculation)
        // ===============================================
        console.log('🔧 Fixing Staff/Teacher Attendance tables...');
        for (const role of ['teacher', 'staff']) {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${role}_attendance (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER,
                    ${role}_id INTEGER,
                    date DATE,
                    status VARCHAR(20), -- Present, Absent, Leave, Holiday
                    remarks TEXT
                );
            `);
        }

        // ===============================================
        // 5. HOLIDAYS (For Salary Calculation)
        // ===============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS school_holidays (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                holiday_date DATE,
                name VARCHAR(100),
                type VARCHAR(50)
            );
        `);

        console.log('✅ Page-Specific Schema Fixes Applied.');
        await client.query('COMMIT');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Page Fixes:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixHiddenPages();
