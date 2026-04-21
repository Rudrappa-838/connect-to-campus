const path = require('path');
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

const cron = require('node-cron');
const { checkAndSendAbsentNotifications } = require('./services/notificationService');

// Schedule Absentee Check at 10:00 AM every day
// cron.schedule('0 10 * * *', () => {
//     checkAndSendAbsentNotifications();
// });

const PORT = process.env.PORT || 5000;

const startServer = async () => {
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
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_attendance') THEN
                        ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS marking_mode VARCHAR(50) DEFAULT 'manual';
                    END IF;
                END $$;
            `);
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

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT} and accepting external connections`);
        });
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
