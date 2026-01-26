const { pool } = require('./src/config/db');

async function checkGradesTable() {
    try {
        console.log('Checking grades table...');
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'grades'
            );
        `);

        if (res.rows[0].exists) {
            console.log('✅ "grades" table exists.');
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'grades'
            `);
            console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
        } else {
            console.log('❌ "grades" table is MISSING.');
        }
    } catch (e) {
        console.error('Error checking grades table:', e);
    } finally {
        pool.end();
    }
}

checkGradesTable();
