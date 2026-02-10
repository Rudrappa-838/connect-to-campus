
const { pool } = require('./src/config/db');

async function checkColumns() {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to DB via existing config!');

        const marksRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'marks' AND column_name IN ('deleted_student_name', 'deleted_student_admission_no');
        `);
        console.log('Marks table extra columns:', marksRes.rows.map(r => r.column_name));

        const certRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'student_certificates' AND column_name IN ('deleted_student_name', 'deleted_student_admission_no');
        `);
        console.log('StudentCertificates table extra columns:', certRes.rows.map(r => r.column_name));

        client.release();
    } catch (err) {
        console.error('❌ Error during check:', err.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
