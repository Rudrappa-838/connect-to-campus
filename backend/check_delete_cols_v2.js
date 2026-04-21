
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    try {
        const client = await pool.connect();
        console.log('Connected to DB');

        const marksRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'marks' AND column_name IN ('deleted_student_name', 'deleted_student_admission_no');
        `);
        console.log('Marks table extra columns:', marksRes.rows);

        const certRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'student_certificates' AND column_name IN ('deleted_student_name', 'deleted_student_admission_no');
        `);
        console.log('StudentCertificates table extra columns:', certRes.rows);

        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
