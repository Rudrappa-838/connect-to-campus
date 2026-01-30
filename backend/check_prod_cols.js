const { pool } = require('./src/config/db');

async function checkProdColumns() {
    try {
        console.log('--- Checking Production DB Columns ---');

        console.log('\n[1] ACADEMIC_YEARS Table:');
        const acRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'academic_years'
        `);
        console.log(acRes.rows.map(r => r.column_name).join(', '));

        console.log('\n[2] SCHOOLS Table:');
        const scRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'schools'
        `);
        console.log(scRes.rows.map(r => r.column_name).join(', '));

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        pool.end();
    }
}

checkProdColumns();
