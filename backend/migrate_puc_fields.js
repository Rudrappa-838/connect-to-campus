const { pool } = require('./src/config/db');

async function migratePUCFields() {
    const client = await pool.connect();
    try {
        console.log('🚀 Migrating PUC specific fields...');
        await client.query('BEGIN');

        // Add SATS Number to students
        await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS sats_number VARCHAR(50);
        `);

        // Add Subject Code to subjects
        await client.query(`
            ALTER TABLE subjects 
            ADD COLUMN IF NOT EXISTS subject_code VARCHAR(10);
        `);

        await client.query('COMMIT');
        console.log('✅ PUC fields migrated successfully');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', e);
    } finally {
        client.release();
        process.exit();
    }
}

migratePUCFields();
