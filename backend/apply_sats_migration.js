const { pool } = require('./src/config/db');
async function migrate() {
    try {
        console.log('Starting migration...');
        await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS sats_number VARCHAR(50)');
        await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)');
        await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100)');
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit(0);
    }
}
migrate();
