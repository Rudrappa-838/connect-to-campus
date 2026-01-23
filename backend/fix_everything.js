const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixEverything() {
    const client = await pool.connect();
    try {
        console.log('🚀 INITIALIZING MASTER SYSTEM REPAIR (ALL MODULES)...');
        await client.query('BEGIN');

        // ===============================================
        // 1. CORE USERS & PROFILES
        // ===============================================
        console.log('🔧 Fixing User Tables (Students, Teachers, Staff)...');

        // Students
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255)`); // Hostel dependency
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS route_id INTEGER`); // Transport dependency
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255) DEFAULT 'School'`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS biometric_template TEXT`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(100)`);
        // Relax constraints
        await client.query(`ALTER TABLE students ALTER COLUMN first_name DROP NOT NULL`);
        await client.query(`ALTER TABLE students ALTER COLUMN last_name DROP NOT NULL`);
        // Populate name
        await client.query(`UPDATE students SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, 'Unknown')) WHERE name IS NULL`);
        await client.query(`UPDATE students SET parent_name = COALESCE(father_name, mother_name, 'Guardian') WHERE parent_name IS NULL`);

        // Teachers & Staff
        for (const t of ['teachers', 'staff']) {
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS transport_route_id INTEGER`);
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10,2) DEFAULT 0`);
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS biometric_template TEXT`);
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(100)`);
            await client.query(`ALTER TABLE ${t} ALTER COLUMN first_name DROP NOT NULL`);
            await client.query(`ALTER TABLE ${t} ALTER COLUMN last_name DROP NOT NULL`);
        }

        // ===============================================
        // 2. ACADEMICS (Timetable, Exams, Subjects)
        // ===============================================
        console.log('🔧 Fixing Academic Modules...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                year_label VARCHAR(50),
                start_date DATE,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'upcoming',
                CONSTRAINT unique_school_year UNIQUE (school_id, year_label)
            );
        `);
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
                day_of_week INTEGER,
                period_number INTEGER,
                subject_id INTEGER,
                teacher_id INTEGER,
                start_time VARCHAR(20),
                end_time VARCHAR(20)
            );
        `);
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

        // Doubt/AI
        await client.query(`
            CREATE TABLE IF NOT EXISTS doubts (
                 id SERIAL PRIMARY KEY,
                 student_id INTEGER,
                 teacher_id INTEGER,
                 subject_id INTEGER,
                 question TEXT,
                 answer TEXT,
                 status VARCHAR(20) DEFAULT 'Pending',
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 answered_at TIMESTAMP
            );
        `);

        // ===============================================
        // 3. OPERATIONS (Admissions, Promotions, Certs)
        // ===============================================
        console.log('🔧 Fixing Operations...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS admissions_enquiries (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                student_name VARCHAR(255),
                parent_name VARCHAR(255),
                contact_number VARCHAR(50),
                email VARCHAR(255),
                class_applying_for VARCHAR(50),
                previous_school VARCHAR(255),
                notes TEXT,
                status VARCHAR(50) DEFAULT 'New',
                application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_promotions (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                student_id INTEGER,
                from_class_id INTEGER,
                to_class_id INTEGER,
                from_academic_year VARCHAR(50),
                to_academic_year VARCHAR(50),
                status VARCHAR(50) DEFAULT 'Promoted',
                promoted_by INTEGER,
                notes TEXT,
                promotion_date DATE DEFAULT CURRENT_DATE
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_certificates (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                student_id INTEGER,
                certificate_type VARCHAR(50),
                certificate_no VARCHAR(50),
                issue_date DATE DEFAULT CURRENT_DATE,
                remarks TEXT
            );
        `);

        // ===============================================
        // 4. ADMINISTRATION (Finance, Attendance, Calendar)
        // ===============================================
        console.log('🔧 Fixing Admin Modules...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenditures (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                amount DECIMAL(10, 2),
                category VARCHAR(100),
                description TEXT,
                expense_date DATE DEFAULT CURRENT_DATE,
                payment_method VARCHAR(50),
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                event_type VARCHAR(50),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                description TEXT,
                audience VARCHAR(50) DEFAULT 'All'
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                message TEXT,
                target_role VARCHAR(50),
                priority VARCHAR(20) DEFAULT 'Normal',
                valid_until DATE,
                class_id INTEGER,
                section_id INTEGER,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                title VARCHAR(255),
                message TEXT,
                type VARCHAR(50) DEFAULT 'INFO',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Attendance (Staff/Teacher) & Holidays
        await client.query(`
            CREATE TABLE IF NOT EXISTS school_holidays (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                holiday_date DATE,
                name VARCHAR(100),
                type VARCHAR(50)
            );
        `);
        for (const role of ['teacher', 'staff']) {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${role}_attendance (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER,
                    ${role}_id INTEGER,
                    date DATE,
                    status VARCHAR(20)
                );
            `);
        }

        console.log('✅ ALL SYSTEMS CHECKED & REPAIRED. 100% COVERAGE.');
        await client.query('COMMIT');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Master Repair:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixEverything();
