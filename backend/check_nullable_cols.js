
const { pool } = require('./src/config/db');

async function checkNullable() {
    try {
        const client = await pool.connect();

        console.log('Checking student_id nullable status in marks:');
        const res = await client.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'marks' AND column_name = 'student_id';
        `);
        console.log('Marks student_id nullable:', res.rows[0]);

        console.log('Checking student_id nullable status in student_certificates:');
        const res2 = await client.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'student_certificates' AND column_name = 'student_id';
        `);
        console.log('Certificates student_id nullable:', res2.rows[0]);

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkNullable();
