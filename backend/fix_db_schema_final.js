const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalSchema() {
    const client = await pool.connect();
    try {
        console.log('🏗️ Starting FINAL DB SCHEMA REPAIR (v2 - with Academic Years)...');
        await client.query('BEGIN');

        // ==========================================
        // 1. CORE & ACADEMIC
        // ==========================================

        // Schools
        await client.query(`CREATE TABLE IF NOT EXISTS schools (id SERIAL PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        const schoolCols = [
            "school_code VARCHAR(50)", "address TEXT", "contact_email VARCHAR(255)",
            "contact_number VARCHAR(50)", "logo TEXT", "is_active BOOLEAN DEFAULT TRUE",
            "subscription_status VARCHAR(50) DEFAULT 'ACTIVE'", "status VARCHAR(50) DEFAULT 'Active'",
            "has_hostel BOOLEAN DEFAULT FALSE", "has_transport BOOLEAN DEFAULT FALSE"
        ];
        for (const col of schoolCols) await client.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS ${col};`);

        // Users
        await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        const userCols = [
            "password VARCHAR(255)", "role VARCHAR(200)", "school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE",
            "current_session_token TEXT", "must_change_password BOOLEAN DEFAULT FALSE", "fcm_token TEXT",
            "reset_password_token TEXT", "reset_password_expires BIGINT"
        ];
        for (const col of userCols) await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col};`);

        // Academic Structure
        await client.query(`CREATE TABLE IF NOT EXISTS classes (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(100), class_teacher_id INTEGER);`);
        await client.query(`CREATE TABLE IF NOT EXISTS sections (id SERIAL PRIMARY KEY, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, name VARCHAR(50), class_teacher_id INTEGER);`);
        await client.query(`CREATE TABLE IF NOT EXISTS subjects (id SERIAL PRIMARY KEY, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, name VARCHAR(100));`);

        // ==========================================
        // 2. PEOPLE
        // ==========================================

        // Students
        await client.query(`CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(100));`);
        const studentCols = [
            "admission_no VARCHAR(100)", "roll_number INTEGER", "class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL", "section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL",
            "first_name VARCHAR(100)", "last_name VARCHAR(100)", "father_name VARCHAR(100)", "mother_name VARCHAR(100)",
            "email VARCHAR(255)", "phone VARCHAR(50)", "contact_number VARCHAR(50)", "dob DATE", "gender VARCHAR(20)", "address TEXT",
            "status VARCHAR(50) DEFAULT 'Active'", "profile_image TEXT", "attendance_id VARCHAR(50)", "admission_date DATE", "age INTEGER"
        ];
        for (const col of studentCols) await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS ${col};`);

        // Teachers
        await client.query(`CREATE TABLE IF NOT EXISTS teachers (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(100));`);
        const teacherCols = [
            "employee_id VARCHAR(100)", "email VARCHAR(255)", "phone VARCHAR(50)", "qualification VARCHAR(255)", "specialization VARCHAR(255)", "subject_specialization VARCHAR(255)",
            "gender VARCHAR(20)", "address TEXT", "join_date DATE", "status VARCHAR(50) DEFAULT 'Active'", "profile_image TEXT",
            "salary_per_day DECIMAL(10, 2) DEFAULT 0", "transport_route_id INTEGER"
        ];
        for (const col of teacherCols) await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS ${col};`);

        // Staff
        await client.query(`CREATE TABLE IF NOT EXISTS staff (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(100));`);
        const staffCols = [
            "employee_id VARCHAR(100)", "email VARCHAR(255)", "phone VARCHAR(50)", "role VARCHAR(100)",
            "gender VARCHAR(20)", "address TEXT", "join_date DATE", "status VARCHAR(50) DEFAULT 'Active'", "profile_image TEXT",
            "salary_per_day DECIMAL(10, 2) DEFAULT 0", "transport_route_id INTEGER"
        ];
        for (const col of staffCols) await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS ${col};`);


        // ==========================================
        // 3. ACADEMIC YEARS (CRITICAL FIX)
        // ==========================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                year_label VARCHAR(20) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'upcoming',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_school_year UNIQUE(school_id, year_label)
            );
        `);

        // Add academic_year_id to related tables
        const ayTables = ['attendance', 'marks', 'fee_payments', 'salary_payments', 'expenditures', 'exam_schedules'];
        for (const t of ayTables) {
            // Create table first if referenced (attendance, marks etc created below usually, but we need ensure cols exist if table exists)
            // We will handle this by creating tables below first, then altering.
        }

        // ==========================================
        // 4. MODULES
        // ==========================================

        // Calendar
        await client.query(`CREATE TABLE IF NOT EXISTS school_holidays (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, holiday_date DATE, holiday_name VARCHAR(255), is_paid BOOLEAN DEFAULT TRUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, title VARCHAR(255), event_type VARCHAR(50), start_date TIMESTAMP, end_date TIMESTAMP, description TEXT, audience VARCHAR(50));`);
        await client.query(`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255), message TEXT, type VARCHAR(50), is_read BOOLEAN, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), title VARCHAR(255), message TEXT, target_role VARCHAR(50), priority VARCHAR(20), valid_until DATE, created_by INTEGER);`);

        // Leaves
        await client.query(`CREATE TABLE IF NOT EXISTS leaves (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), user_id INTEGER, role VARCHAR(20), leave_type VARCHAR(50), start_date DATE, end_date DATE, reason TEXT, status VARCHAR(20) DEFAULT 'Pending');`);

        // Exams & Marks
        await client.query(`CREATE TABLE IF NOT EXISTS exam_types (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, name VARCHAR(100), max_marks INTEGER, weightage INTEGER);`);
        await client.query(`CREATE TABLE IF NOT EXISTS exam_components (id SERIAL PRIMARY KEY, exam_type_id INTEGER REFERENCES exam_types(id) ON DELETE CASCADE, component_name VARCHAR(100), max_marks INTEGER, display_order INTEGER);`);
        await client.query(`CREATE TABLE IF NOT EXISTS exam_schedules (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), exam_type_id INTEGER REFERENCES exam_types(id), class_id INTEGER REFERENCES classes(id), section_id INTEGER REFERENCES sections(id), subject_id INTEGER REFERENCES subjects(id), exam_date DATE, start_time TIME, end_time TIME);`);

        await client.query(`CREATE TABLE IF NOT EXISTS marks (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), student_id INTEGER REFERENCES students(id), subject_id INTEGER REFERENCES subjects(id), exam_type_id INTEGER REFERENCES exam_types(id), marks_obtained DECIMAL(5,2), remarks TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS mark_components (id SERIAL PRIMARY KEY, mark_id INTEGER REFERENCES marks(id) ON DELETE CASCADE, component_id INTEGER REFERENCES exam_components(id), marks_obtained DECIMAL(5,2));`);
        await client.query(`CREATE TABLE IF NOT EXISTS grades (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), grade_name VARCHAR(5), min_percentage INTEGER, max_percentage INTEGER, remarks VARCHAR(100));`);

        // Timetable
        await client.query(`CREATE TABLE IF NOT EXISTS timetables (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), class_id INTEGER REFERENCES classes(id), section_id INTEGER REFERENCES sections(id), day_of_week INTEGER, period_number INTEGER, subject_id INTEGER REFERENCES subjects(id), teacher_id INTEGER REFERENCES teachers(id), start_time TIME, end_time TIME);`);

        // Library
        await client.query(`CREATE TABLE IF NOT EXISTS library_books (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), book_number VARCHAR(50), title VARCHAR(255), author VARCHAR(255), category VARCHAR(100), status VARCHAR(20));`);
        await client.query(`CREATE TABLE IF NOT EXISTS library_transactions (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), book_id INTEGER REFERENCES library_books(id), patron_type VARCHAR(20), patron_id VARCHAR(50), patron_name VARCHAR(100), issue_date TIMESTAMP, due_date TIMESTAMP, return_date TIMESTAMP, status VARCHAR(20), fine_amount DECIMAL(10,2));`);

        // Hostel
        await client.query(`CREATE TABLE IF NOT EXISTS hostels (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), name VARCHAR(100), type VARCHAR(20), warden_name VARCHAR(100));`);
        await client.query(`CREATE TABLE IF NOT EXISTS hostel_rooms (id SERIAL PRIMARY KEY, hostel_id INTEGER REFERENCES hostels(id) ON DELETE CASCADE, room_number VARCHAR(20), capacity INTEGER, cost_per_term DECIMAL(10,2));`);
        await client.query(`CREATE TABLE IF NOT EXISTS hostel_allocations (id SERIAL PRIMARY KEY, room_id INTEGER REFERENCES hostel_rooms(id), student_id INTEGER REFERENCES students(id), allocation_date DATE, vacating_date DATE, status VARCHAR(20));`);
        await client.query(`CREATE TABLE IF NOT EXISTS hostel_mess_bills (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id), month INTEGER, year INTEGER, amount DECIMAL(10,2), status VARCHAR(50));`);
        await client.query(`CREATE TABLE IF NOT EXISTS hostel_payments (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id), amount DECIMAL(10,2), payment_type VARCHAR(50), related_bill_id INTEGER);`);

        // Transport
        await client.query(`CREATE TABLE IF NOT EXISTS transport_vehicles (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), vehicle_number VARCHAR(20), driver_name VARCHAR(100), driver_phone VARCHAR(20), capacity INTEGER, current_lat DECIMAL(10,8), current_lng DECIMAL(11,8));`);
        await client.query(`CREATE TABLE IF NOT EXISTS transport_routes (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), vehicle_id INTEGER REFERENCES transport_vehicles(id), route_name VARCHAR(100), start_point VARCHAR(100), end_point VARCHAR(100), start_time TIME);`);
        await client.query(`CREATE TABLE IF NOT EXISTS transport_stops (id SERIAL PRIMARY KEY, route_id INTEGER REFERENCES transport_routes(id) ON DELETE CASCADE, stop_name VARCHAR(100), stop_order INTEGER, lat DECIMAL(10,8), lng DECIMAL(11,8), pickup_time TIME);`);

        // Fees
        await client.query(`CREATE TABLE IF NOT EXISTS fee_structures (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id), name VARCHAR(100), amount DECIMAL(10, 2), due_date DATE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS student_fees (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id) ON DELETE CASCADE, fee_structure_id INTEGER REFERENCES fee_structures(id), amount_paid DECIMAL(10, 2), status VARCHAR(50), due_date DATE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS fee_payments (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), student_id INTEGER REFERENCES students(id), fee_structure_id INTEGER REFERENCES fee_structures(id), amount_paid DECIMAL(10,2), payment_date DATE, payment_method VARCHAR(50));`);

        // Payroll & Expenditures
        await client.query(`CREATE TABLE IF NOT EXISTS salary_payments (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), staff_id INTEGER REFERENCES staff(id), teacher_id INTEGER REFERENCES teachers(id), month INTEGER, year INTEGER, amount DECIMAL(10,2), status VARCHAR(20));`);
        await client.query(`CREATE TABLE IF NOT EXISTS expenditures (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), title VARCHAR(255), amount DECIMAL(10,2), category VARCHAR(50), expense_date DATE, payment_method VARCHAR(50));`);

        // Misc
        await client.query(`CREATE TABLE IF NOT EXISTS doubts (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id), teacher_id INTEGER REFERENCES teachers(id), subject_id INTEGER REFERENCES subjects(id), question TEXT, answer TEXT, status VARCHAR(50));`);
        await client.query(`CREATE TABLE IF NOT EXISTS student_certificates (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), student_id INTEGER REFERENCES students(id), certificate_type VARCHAR(50), issue_date DATE, certificate_no VARCHAR(50));`);
        await client.query(`CREATE TABLE IF NOT EXISTS admissions_enquiries (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), student_name VARCHAR(255), parent_name VARCHAR(255), contact_number VARCHAR(15), class_applying_for VARCHAR(50), status VARCHAR(50));`);

        // Attendance
        await client.query(`CREATE TABLE IF NOT EXISTS attendance (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), student_id INTEGER REFERENCES students(id), date DATE, status VARCHAR(20), UNIQUE(student_id, date));`);
        await client.query(`CREATE TABLE IF NOT EXISTS teacher_attendance (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), teacher_id INTEGER REFERENCES teachers(id), date DATE, status VARCHAR(20), UNIQUE(teacher_id, date));`);
        await client.query(`CREATE TABLE IF NOT EXISTS staff_attendance (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id), staff_id INTEGER REFERENCES staff(id), date DATE, status VARCHAR(20), UNIQUE(staff_id, date));`);

        // ==========================================
        // 5. LINK ACADEMIC YEARS
        // ==========================================
        for (const t of ['attendance', 'marks', 'fee_payments', 'salary_payments', 'expenditures', 'exam_schedules']) {
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL;`);
        }

        // ==========================================
        // 6. SEED DEFAULT ACADEMIC YEAR (2025-2026)
        // ==========================================
        const now = new Date();
        const yStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // April start
        const yEnd = yStart + 1;
        const yearLabel = `${yStart}-${yEnd}`;

        await client.query(`
            INSERT INTO academic_years (school_id, year_label, start_date, end_date, status)
            SELECT id, $1, $2, $3, 'active' 
            FROM schools
            ON CONFLICT (school_id, year_label) DO NOTHING
        `, [yearLabel, `${yStart}-04-01`, `${yEnd}-03-31`]);

        console.log('🎉 ALL TABLES & COLUMNS (CORE, ACADEMIC, MODULES, YEARS) VERIFIED!');
        await client.query('COMMIT');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing schema:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalSchema();
