const { pool } = require('./src/config/db');

async function fixMissingTables() {
    console.log('🌿 Environment: production | 🌐 DB: PRODUCTION (AWS RDS)');
    
    try {
        console.log('Checking for marksheet_custom_templates table...');
        
        // 1. Create marksheet_custom_templates table if missing
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marksheet_custom_templates (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                is_default BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ marksheet_custom_templates table verified/created.');

        // 2. Fix missing created_at columns in attendance tables
        console.log('Verifying attendance timestamps...');
        await pool.query(`
            ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Attendance timestamps verified.');

        // 3. Fix missing columns in schools table
        console.log('Verifying school table columns...');
        await pool.query(`
            ALTER TABLE schools ADD COLUMN IF NOT EXISTS institution_type VARCHAR(50) DEFAULT 'SCHOOL';
            ALTER TABLE schools ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
            ALTER TABLE schools ADD COLUMN IF NOT EXISTS marksheet_template VARCHAR(100) DEFAULT 'default';
        `);
        console.log('✅ School table columns verified.');

        // 2. Ensure students table has admission_no (standardizing for today-attendance query)
        // (Just a safety check, it should already exist)
        
        // 3. Migrate PUC specific fields
        console.log('Migrating PUC specific fields...');
        await pool.query(`
            ALTER TABLE students ADD COLUMN IF NOT EXISTS sats_number VARCHAR(50);
            ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_code VARCHAR(10);
        `);

        console.log('✅ All schema fixes completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Schema fix failed:', err);
        process.exit(1);
    }
}

fixMissingTables();
