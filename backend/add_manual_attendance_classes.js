const { pool } = require('./src/config/db.js');

async function runMigration() {
    try {
        console.log('Starting migration...');
        
        await pool.query(`
            ALTER TABLE teachers 
            ADD COLUMN IF NOT EXISTS manual_attendance_classes JSONB DEFAULT '[]';
        `);
        console.log('Added manual_attendance_classes to teachers table.');

        await pool.query(`
            ALTER TABLE staff 
            ADD COLUMN IF NOT EXISTS manual_attendance_classes JSONB DEFAULT '[]';
        `);
        console.log('Added manual_attendance_classes to staff table.');

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}

runMigration();
