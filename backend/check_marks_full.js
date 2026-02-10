
const { pool } = require('./src/config/db');

async function checkMarks() {
    try {
        const client = await pool.connect();

        console.log('Fetching columns for marks table:');
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'marks'
        `);
        console.table(res.rows);

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkMarks();
