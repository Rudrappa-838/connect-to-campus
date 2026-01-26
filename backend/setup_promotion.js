require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./src/config/db');

const runMigration = async () => {
    console.log('🔄 Starting Promotion System Setup...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Add academic_year column to students table
        console.log('1. Updating Students Table...');
        await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2025-2026'
        `);

        // 2. Add academic_year to attendance table
        console.log('2. Updating Attendance Table...');
        await client.query(`
            ALTER TABLE attendance 
            ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2025-2026'
        `);

        // 3. Add academic_year to marks table (if exists)
        console.log('3. Updating Marks Table...');
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marks') THEN
                    ALTER TABLE marks ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2025-2026';
                END IF;
            END $$;
        `);

        // 4. Add academic_year to fee_payments table (if exists)
        console.log('4. Updating Fee Payments Table...');
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
                    ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2025-2026';
                END IF;
            END $$;
        `);

        // 5. Create student_promotions table
        console.log('5. Creating Promotion History Table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_promotions (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                from_class_id INTEGER REFERENCES classes(id),
                from_section_id INTEGER REFERENCES sections(id),
                to_class_id INTEGER REFERENCES classes(id),
                to_section_id INTEGER REFERENCES sections(id),
                from_academic_year VARCHAR(20) NOT NULL,
                to_academic_year VARCHAR(20) NOT NULL,
                promoted_by INTEGER REFERENCES users(id),
                promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        `);

        // 6. Create indexes
        console.log('6. Creating Performance Indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON attendance(academic_year)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_promotions_student ON student_promotions(student_id)`);

        await client.query('COMMIT');
        console.log('✅ Promotion System Setup Completed Successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error during setup:', error);
    } finally {
        client.release();
        pool.end();
    }
};

runMigration();
