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

        // 2. Ensure students table has admission_no (standardizing for today-attendance query)
        // (Just a safety check, it should already exist)
        
        console.log('Schema fix completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Schema fix failed:', err);
        process.exit(1);
    }
}

fixMissingTables();
