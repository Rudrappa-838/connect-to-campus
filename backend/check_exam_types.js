const { pool } = require('./src/config/db');

async function checkExamTypes() {
    try {
        console.log('Checking exam_types table...');
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'exam_types'
            );
        `);

        if (res.rows[0].exists) {
            console.log('✅ "exam_types" table exists.');
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'exam_types'
            `);
            console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
        } else {
            console.log('❌ "exam_types" table is MISSING.');
        }
    } catch (e) {
        console.error('Error checking exam_types table:', e);
    } finally {
        pool.end();
    }
}

checkExamTypes();
