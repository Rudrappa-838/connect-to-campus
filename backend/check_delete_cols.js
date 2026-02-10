
const { pool } = require('./src/config/db');

async function checkColumns() {
    try {
        const client = await pool.connect();

        console.log('Checking columns for marks table:');
        const marksCols = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'marks';
        `);
        console.log(marksCols.rows.map(r => r.column_name));

        console.log('\nChecking columns for student_certificates table:');
        const certCols = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'student_certificates';
        `);
        if (certCols.rows.length === 0) {
            console.log('student_certificates table NOT FOUND. Checking certificates...');
            const certCols2 = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'certificates';
            `);
            console.log(certCols2.rows.map(r => r.column_name));
        } else {
            console.log(certCols.rows.map(r => r.column_name));
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkColumns();
