const { pool } = require('./src/config/db');

async function migrate() {
    try {
        console.log('Starting migration for marksheet_template...');
        await pool.query(`
            ALTER TABLE schools 
            ADD COLUMN IF NOT EXISTS marksheet_template VARCHAR(50) DEFAULT 'STANDARD';
        `);
        console.log('✅ Successfully added marksheet_template to schools table!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit(0);
    }
}

migrate();
