const { pool } = require('./src/config/db');

async function migrate() {
    try {
        console.log('Starting migration for marksheet custom templates...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS marksheet_custom_templates (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                file_path TEXT NOT NULL,
                is_default BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Successfully created marksheet_custom_templates table!');

        // Ensure only one default per school
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS unique_default_marksheet_template 
            ON marksheet_custom_templates(school_id) 
            WHERE is_default = true;
        `);
        console.log('✅ Successfully created index for single default template.');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit(0);
    }
}

migrate();
