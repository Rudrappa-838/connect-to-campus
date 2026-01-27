const { pool } = require('./src/config/db');

async function fixStudentSchema() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Starting Schema Fix for Students...');

        // 1. Add 'status' column to students if missing
        console.log('Checking students.status column...');
        await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
        `);
        console.log('✅ Checked/Added students.status');

        // 2. Add 'deleted_student_name' to marks if missing
        console.log('Checking marks.deleted_student_name...');
        await client.query(`
            ALTER TABLE marks 
            ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50);
        `);
        console.log('✅ Checked/Added marks deleted columns');

        // 3. Add 'deleted_student_name' to certificates if missing
        console.log('Checking student_certificates.deleted_student_name...');
        await client.query(`
            ALTER TABLE student_certificates 
            ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50);
        `);
        console.log('✅ Checked/Added student_certificates deleted columns');

        await client.query('COMMIT');
        console.log('🎉 Schema Fix Completed Successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing schema:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixStudentSchema();
