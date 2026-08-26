const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

// Explicitly load .env from root of backend
const result = dotenv.config({ path: path.join(__dirname, '../.env') });

if (result.error) {
    console.error("❌ Failed to load .env file:", result.error);
} else {
    console.log("✅ .env file loaded successfully.");
    console.log("   GEMINI_API_KEY Present:", !!process.env.GEMINI_API_KEY);
    console.log("   EMAIL_USER Present:", !!process.env.EMAIL_USER);
}
const app = require('./app');
const { pool } = require('./config/db');
const { initSocket } = require('./services/socketService');

// Create HTTP server (needed for Socket.IO)
const httpServer = http.createServer(app);

// Initialize Socket.IO for real-time GPS tracking
initSocket(httpServer);

const cron = require('node-cron');
const { checkAndSendAbsentNotifications } = require('./services/notificationService');

// Schedule Absentee Check at 1:00 AM every day (Checks previous day's attendance)
cron.schedule('0 1 * * *', () => {
    checkAndSendAbsentNotifications();
});

const PORT = process.env.PORT || 5000;
let isListening = false;

const startServer = async () => {
    if (!isListening) {
        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT} with Socket.IO GPS tracking enabled`);
        });
        isListening = true;
    }

    try {
        // Test DB connection
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL database');

        // Auto-run migrations (Schema Updates)
        try {
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expenditures') THEN
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expenditures' AND column_name = 'transaction_id') THEN
                            ALTER TABLE expenditures ADD COLUMN transaction_id VARCHAR(100);
                        END IF;
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expenditures' AND column_name = 'upi_id') THEN
                            ALTER TABLE expenditures ADD COLUMN upi_id VARCHAR(100);
                        END IF;
                    END IF;
                END $$;
            `);

            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doubts') THEN
                        ALTER TABLE doubts ALTER COLUMN subject_id DROP NOT NULL;
                    END IF;
                END $$;
            `);

            await client.query(`
                ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo TEXT;
            `);

            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'attachment_url') THEN
                            ALTER TABLE notifications ADD COLUMN attachment_url TEXT;
                        END IF;
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'attachment_type') THEN
                            ALTER TABLE notifications ADD COLUMN attachment_type VARCHAR(100);
                        END IF;
                    END IF;
                END $$;
            `);
            
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'announcements') THEN
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'attachment_url') THEN
                            ALTER TABLE announcements ADD COLUMN attachment_url TEXT;
                        END IF;
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'attachment_type') THEN
                            ALTER TABLE announcements ADD COLUMN attachment_type VARCHAR(100);
                        END IF;
                    END IF;
                END $$;
            `);

            // Fix: Add missing columns to users table (Session & Security)
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_session_token') THEN
                            ALTER TABLE users ADD COLUMN current_session_token TEXT;
                        END IF;
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'must_change_password') THEN
                            ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
                        END IF;
                        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fcm_token') THEN
                            ALTER TABLE users ADD COLUMN fcm_token TEXT;
                        END IF;
                    END IF;
                END $$;
            `);

            // Fix: Ensure grades table allows decimals (critical for '89.99' error)
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'grades') THEN
                        -- We use explicit casting to allow integer -> numeric conversion if needed
                        ALTER TABLE grades ALTER COLUMN min_percentage TYPE NUMERIC(5,2);
                        ALTER TABLE grades ALTER COLUMN max_percentage TYPE NUMERIC(5,2);
                        ALTER TABLE grades ALTER COLUMN grade_point TYPE NUMERIC(3,1);
                    END IF;
                END $$;
            `);

            // Fix: Allow NULL student_id in marks and certificates for permanent deletion
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks') THEN
                        ALTER TABLE marks ALTER COLUMN student_id DROP NOT NULL;
                        ALTER TABLE marks ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255);
                        ALTER TABLE marks ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50);
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'exam_schedules') THEN
                        ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
                    END IF;

                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_certificates') THEN
                        ALTER TABLE student_certificates ALTER COLUMN student_id DROP NOT NULL;
                        ALTER TABLE student_certificates ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255);
                        ALTER TABLE student_certificates ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50);
                    END IF;

                    -- Create student_reviews table for Teacher-Student individual feedback
                    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_reviews') THEN
                        CREATE TABLE student_reviews (
                            id SERIAL PRIMARY KEY,
                            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                            student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                            sender_id INTEGER NOT NULL, -- User ID of teacher or admin
                            sender_role VARCHAR(50) NOT NULL, -- TEACHER or SCHOOL_ADMIN
                            sender_name VARCHAR(255), 
                            message TEXT NOT NULL,
                            review_type VARCHAR(50) DEFAULT 'GENERAL', -- GENERAL, PERFORMANCE, DISCIPLINE
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    END IF;

                    -- A. SCHOOLS TABLE HARDENING (Master Switches)
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') THEN
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_face_enrollment BOOLEAN DEFAULT TRUE;
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_face_scanner BOOLEAN DEFAULT TRUE;
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_biometric BOOLEAN DEFAULT TRUE;
                        UPDATE schools SET has_face_enrollment = TRUE, has_face_scanner = TRUE, has_biometric = TRUE 
                        WHERE has_face_enrollment IS NULL OR has_face_scanner IS NULL OR has_biometric IS NULL;
                    END IF;

                    -- B. USER TABLES HARDENING (Biometric Template Storage)
                    -- Students
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'students') THEN
                         ALTER TABLE students ADD COLUMN IF NOT EXISTS biometric_template TEXT;
                         ALTER TABLE students ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(100);
                         ALTER TABLE students ADD COLUMN IF NOT EXISTS biometric_template_format VARCHAR(50) DEFAULT 'face-api-js';
                         ALTER TABLE students ADD COLUMN IF NOT EXISTS custom_roll_number VARCHAR(100);
                         ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                    END IF;

                    -- Teachers
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teachers') THEN
                         ALTER TABLE teachers ADD COLUMN IF NOT EXISTS biometric_template TEXT;
                         ALTER TABLE teachers ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(100);
                         ALTER TABLE teachers ADD COLUMN IF NOT EXISTS biometric_template_format VARCHAR(50) DEFAULT 'face-api-js';
                         ALTER TABLE teachers ADD COLUMN IF NOT EXISTS can_enroll_face BOOLEAN DEFAULT TRUE;
                         ALTER TABLE teachers ADD COLUMN IF NOT EXISTS can_take_face_attendance BOOLEAN DEFAULT TRUE;
                         ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                         UPDATE teachers SET can_enroll_face = TRUE, can_take_face_attendance = TRUE 
                         WHERE can_enroll_face IS NULL OR can_take_face_attendance IS NULL;
                    END IF;

                    -- Staff
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff') THEN
                         ALTER TABLE staff ADD COLUMN IF NOT EXISTS biometric_template TEXT;
                         ALTER TABLE staff ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(100);
                         ALTER TABLE staff ADD COLUMN IF NOT EXISTS biometric_template_format VARCHAR(50) DEFAULT 'face-api-js';
                         ALTER TABLE staff ADD COLUMN IF NOT EXISTS can_enroll_face BOOLEAN DEFAULT TRUE;
                         ALTER TABLE staff ADD COLUMN IF NOT EXISTS can_take_face_attendance BOOLEAN DEFAULT TRUE;
                         ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                         UPDATE staff SET can_enroll_face = TRUE, can_take_face_attendance = TRUE 
                         WHERE can_enroll_face IS NULL OR can_take_face_attendance IS NULL;
                    END IF;

                    -- C. ATTENDANCE TABLES HARDENING (Marking Modes)
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance') THEN
                        ALTER TABLE attendance ADD COLUMN IF NOT EXISTS marking_mode VARCHAR(50) DEFAULT 'manual';
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teacher_attendance') THEN
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS marking_mode VARCHAR(50) DEFAULT 'manual';
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS check_in_lat DECIMAL(9, 6);
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS check_in_lng DECIMAL(9, 6);
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS check_out_lat DECIMAL(9, 6);
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS check_out_lng DECIMAL(9, 6);
                        ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS working_hours NUMERIC(5, 2);
                        -- Force migration to TIMESTAMPTZ in case columns were already created as TIMESTAMP
                        ALTER TABLE teacher_attendance ALTER COLUMN check_in_time TYPE TIMESTAMPTZ;
                        ALTER TABLE teacher_attendance ALTER COLUMN check_out_time TYPE TIMESTAMPTZ;
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_attendance') THEN
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS marking_mode VARCHAR(50) DEFAULT 'manual';
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS check_in_lat DECIMAL(9, 6);
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS check_in_lng DECIMAL(9, 6);
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS check_out_lat DECIMAL(9, 6);
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS check_out_lng DECIMAL(9, 6);
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS working_hours NUMERIC(5, 2);
                        -- Force migration to TIMESTAMPTZ in case columns were already created as TIMESTAMP
                        ALTER TABLE staff_attendance ALTER COLUMN check_in_time TYPE TIMESTAMPTZ;
                        ALTER TABLE staff_attendance ALTER COLUMN check_out_time TYPE TIMESTAMPTZ;
                    END IF;

                    -- D. SCHOOLS GPS SETTINGS
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') THEN
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude DECIMAL(9, 6);
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS longitude DECIMAL(9, 6);
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS attendance_radius INTEGER DEFAULT 200;
                    END IF;

                    -- E. GEOFENCE LOGS FOR TEACHERS
                    CREATE TABLE IF NOT EXISTS teacher_attendance_geofence_logs (
                        id SERIAL PRIMARY KEY,
                        school_id INTEGER NOT NULL,
                        teacher_id INTEGER NOT NULL,
                        date DATE NOT NULL,
                        event_type VARCHAR(20) NOT NULL, -- 'CHECK_IN' or 'CHECK_OUT'
                        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        latitude DECIMAL(9, 6),
                        longitude DECIMAL(9, 6),
                        distance NUMERIC(10, 2)
                    );
                    CREATE INDEX IF NOT EXISTS idx_geofence_logs_teacher_date ON teacher_attendance_geofence_logs(teacher_id, date);

                    -- F. GEOFENCE LOGS FOR STAFF
                    CREATE TABLE IF NOT EXISTS staff_attendance_geofence_logs (
                        id SERIAL PRIMARY KEY,
                        school_id INTEGER NOT NULL,
                        staff_id INTEGER NOT NULL,
                        date DATE NOT NULL,
                        event_type VARCHAR(20) NOT NULL, -- 'CHECK_IN' or 'CHECK_OUT'
                        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        latitude DECIMAL(9, 6),
                        longitude DECIMAL(9, 6),
                        distance NUMERIC(10, 2)
                    );
                    CREATE INDEX IF NOT EXISTS idx_geofence_logs_staff_date ON staff_attendance_geofence_logs(staff_id, date);
                END $$;
            `);
            // Fix: Add missing columns to schools table (institution_type, gemini_api_key, marksheet_template)
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') THEN
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS institution_type VARCHAR(50) DEFAULT 'SCHOOL';
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS marksheet_template TEXT;
                    END IF;
                END $$;
            `);

            // Fix: Add missing columns to students table (class_name, section_name for unassign tracking)
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'students') THEN
                        ALTER TABLE students ADD COLUMN IF NOT EXISTS class_name VARCHAR(255);
                        ALTER TABLE students ADD COLUMN IF NOT EXISTS section_name VARCHAR(255);
                    END IF;
                END $$;
            `);

            // Fix: Create student_promotions table if it doesn't exist
            await client.query(`
                CREATE TABLE IF NOT EXISTS student_promotions (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                    from_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
                    from_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
                    to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
                    to_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
                    from_academic_year_id INTEGER,
                    to_academic_year_id INTEGER,
                    promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    promoted_by INTEGER
                );
            `);

            // Fix: Create marksheet_custom_templates table if it doesn't exist
            await client.query(`
                CREATE TABLE IF NOT EXISTS marksheet_custom_templates (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    file_data BYTEA,
                    file_name VARCHAR(255),
                    is_default BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Fix: Alter foreign keys on fee_payments and student_fees to be ON DELETE CASCADE to allow deleting classes/fee_structures
            await client.query(`
                DO $$ 
                BEGIN 
                    -- fee_payments to fee_structures
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
                        ALTER TABLE fee_payments DROP CONSTRAINT IF EXISTS fee_payments_fee_structure_id_fkey;
                        ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_fee_structure_id_fkey 
                            FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE;
                    END IF;

                    -- student_fees to fee_structures
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_fees') THEN
                        ALTER TABLE student_fees DROP CONSTRAINT IF EXISTS student_fees_fee_structure_id_fkey;
                        ALTER TABLE student_fees ADD CONSTRAINT student_fees_fee_structure_id_fkey 
                            FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `);

            // Fix: Alter foreign keys on timetables, exam_schedules, and marks to ON DELETE CASCADE for cascading deletion of classes, sections, and subjects
            await client.query(`
                DO $$ 
                BEGIN 
                    -- timetables class_id, section_id, subject_id
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timetables') THEN
                        ALTER TABLE timetables DROP CONSTRAINT IF EXISTS timetables_class_id_fkey;
                        ALTER TABLE timetables ADD CONSTRAINT timetables_class_id_fkey 
                            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
                            
                        ALTER TABLE timetables DROP CONSTRAINT IF EXISTS timetables_section_id_fkey;
                        ALTER TABLE timetables ADD CONSTRAINT timetables_section_id_fkey 
                            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;

                        ALTER TABLE timetables DROP CONSTRAINT IF EXISTS timetables_subject_id_fkey;
                        ALTER TABLE timetables ADD CONSTRAINT timetables_subject_id_fkey 
                            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
                    END IF;

                    -- exam_schedules class_id, section_id, subject_id
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'exam_schedules') THEN
                        ALTER TABLE exam_schedules DROP CONSTRAINT IF EXISTS exam_schedules_class_id_fkey;
                        ALTER TABLE exam_schedules ADD CONSTRAINT exam_schedules_class_id_fkey 
                            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
                            
                        ALTER TABLE exam_schedules DROP CONSTRAINT IF EXISTS exam_schedules_section_id_fkey;
                        ALTER TABLE exam_schedules ADD CONSTRAINT exam_schedules_section_id_fkey 
                            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;

                        ALTER TABLE exam_schedules DROP CONSTRAINT IF EXISTS exam_schedules_subject_id_fkey;
                        ALTER TABLE exam_schedules ADD CONSTRAINT exam_schedules_subject_id_fkey 
                            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
                    END IF;

                    -- marks subject_id
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks') THEN
                        ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_subject_id_fkey;
                        ALTER TABLE marks ADD CONSTRAINT marks_subject_id_fkey 
                            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `);

            // ─── EXAM SYSTEM v2 — Universal (Schools + PU Colleges) ─────────────────────
            // Subject Master
            await client.query(`
                CREATE TABLE IF NOT EXISTS exam_subjects (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    subject_code VARCHAR(50),
                    type VARCHAR(50) DEFAULT 'CORE',
                    is_common_to_all BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Subject Groups (Combinations like PCMB, PCMC, General)
            await client.query(`
                CREATE TABLE IF NOT EXISTS exam_subject_groups (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_default BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Language/Choice Pools (Kannada OR Hindi OR Sanskrit — pick one)
            await client.query(`
                CREATE TABLE IF NOT EXISTS exam_choice_pools (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    group_id INTEGER REFERENCES exam_subject_groups(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL
                );
            `);

            // Links subjects to groups with required/optional and choice pool info
            await client.query(`
                CREATE TABLE IF NOT EXISTS exam_group_subjects (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER REFERENCES exam_subject_groups(id) ON DELETE CASCADE,
                    subject_id INTEGER REFERENCES exam_subjects(id) ON DELETE CASCADE,
                    is_required BOOLEAN DEFAULT TRUE,
                    choice_pool_id INTEGER REFERENCES exam_choice_pools(id) ON DELETE SET NULL,
                    UNIQUE(group_id, subject_id)
                );
            `);

            // Student to group assignment (which combination a student chose)
            await client.query(`
                CREATE TABLE IF NOT EXISTS student_subject_assignments (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                    academic_year VARCHAR(20) NOT NULL,
                    group_id INTEGER REFERENCES exam_subject_groups(id) ON DELETE SET NULL,
                    chosen_subjects JSONB DEFAULT '[]',
                    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, school_id, class_id, academic_year)
                );
            `);

            // Exam Events (CIE-1, Monthly Jan, Annual Exam, etc.)
            await client.query(`
                CREATE TABLE IF NOT EXISTS exam_events (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    exam_type VARCHAR(50) DEFAULT 'CUSTOM',
                    academic_year VARCHAR(20),
                    start_date DATE,
                    end_date DATE,
                    status VARCHAR(20) DEFAULT 'DRAFT',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Timetable slots — one row per subject per exam event
            await client.query(`
                CREATE TABLE IF NOT EXISTS exam_timetable_slots (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER REFERENCES exam_events(id) ON DELETE CASCADE,
                    subject_id INTEGER REFERENCES exam_subjects(id) ON DELETE CASCADE,
                    exam_date DATE,
                    start_time TIME,
                    duration_minutes INTEGER DEFAULT 180,
                    room_number VARCHAR(50),
                    invigilator_name VARCHAR(255),
                    max_theory_marks NUMERIC(6,2) DEFAULT 100,
                    max_practical_marks NUMERIC(6,2) DEFAULT 0,
                    max_total_marks NUMERIC(6,2) DEFAULT 100
                );
            `);

            // Student marks per timetable slot
            await client.query(`
                CREATE TABLE IF NOT EXISTS student_exam_marks (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                    slot_id INTEGER REFERENCES exam_timetable_slots(id) ON DELETE CASCADE,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    theory_marks NUMERIC(6,2),
                    practical_marks NUMERIC(6,2) DEFAULT 0,
                    total_marks NUMERIC(6,2),
                    is_absent BOOLEAN DEFAULT FALSE,
                    remarks TEXT,
                    entered_by INTEGER,
                    entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_verified BOOLEAN DEFAULT FALSE,
                    UNIQUE(student_id, slot_id)
                );
            `);

            console.log('✅ Exam System v2 tables ready');
            // ─────────────────────────────────────────────────────────────────────────────

            // Out Pass / Gate Pass system
            await client.query(`
                CREATE TABLE IF NOT EXISTS out_passes (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL,
                    person_type VARCHAR(10) NOT NULL,
                    person_name VARCHAR(255),
                    reason TEXT NOT NULL,
                    checkout_time TIMESTAMPTZ DEFAULT NOW(),
                    checkin_time TIMESTAMPTZ,
                    status VARCHAR(20) DEFAULT 'OUT',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_out_passes_school_date ON out_passes(school_id, checkout_time);
            `);
            
            // Fix for early manual migrations that used person_id instead of user_id
            try {
                await client.query(`ALTER TABLE out_passes RENAME COLUMN person_id TO user_id;`);
                console.log('✅ Renamed person_id to user_id in out_passes');
            } catch (e) {
                // Ignore if column doesn't exist or already renamed
            }
            // ─────────────────────────────────────────────────────────────────────────────
            // Hostel Module Auto-Migration
            await client.query(`
                CREATE TABLE IF NOT EXISTS hostels (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50),
                    address TEXT,
                    warden_name VARCHAR(255),
                    contact_number VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS hostel_rooms (
                    id SERIAL PRIMARY KEY,
                    hostel_id INTEGER REFERENCES hostels(id) ON DELETE CASCADE,
                    room_number VARCHAR(50) NOT NULL,
                    capacity INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS hostel_allocations (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                    room_id INTEGER REFERENCES hostel_rooms(id) ON DELETE CASCADE,
                    allocation_date DATE NOT NULL,
                    status VARCHAR(50) DEFAULT 'Occupied',
                    vacated_date DATE,
                    monthly_fee NUMERIC(10, 2) DEFAULT 0,
                    payment_status VARCHAR(50) DEFAULT 'Pending',
                    fee_remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS hostel_attendance (
                    id SERIAL PRIMARY KEY,
                    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                    hostel_id INTEGER REFERENCES hostels(id) ON DELETE CASCADE,
                    date DATE NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, date)
                );
            `);

            // Also run alter tables to add any missing columns in case tables existed but were missing newer columns
            try {
                await client.query(`
                    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS address TEXT;
                    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS type VARCHAR(50);
                    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS warden_name VARCHAR(255);
                    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50);
                    ALTER TABLE hostel_allocations ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10, 2) DEFAULT 0;
                    ALTER TABLE hostel_allocations ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending';
                    ALTER TABLE hostel_allocations ADD COLUMN IF NOT EXISTS fee_remarks TEXT;
                `);
            } catch (e) {
                // Ignore if already exist
            }
            // ─────────────────────────────────────────────────────────────────────────────

            console.log('✅ Database schema verified.');
        } catch (migError) {
            console.warn('⚠️ Some migrations could not be applied automatically:', migError.message);
        }

        // Auto-run migrations if needed (simple check)
        const check = await client.query("SELECT to_regclass('public.users')");
        if (!check.rows[0].to_regclass) {
            console.log('⚠️ Database seems empty. Running initialization...');
            const { createTables } = require('./scripts/initDb');
            await createTables(client);
        }

        client.release();
        console.log('✅ Database schema verified.');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('🔄 Retrying in 5 seconds...');
        setTimeout(startServer, 5000);
    }
};

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down gracefully...');
    console.error(err.name, err.message, err.stack);
    // process.exit(1); // Do NOT exit, keep running if possible, or restart. For "don't crash" request, we log.
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥');
    console.error(err.name, err.message);
});

startServer();
