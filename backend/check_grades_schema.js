const { pool } = require('./src/config/db');

async function check() {
    try {
        console.log('Checking grades table schema...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'grades'
        `);

        if (res.rows.length === 0) {
            console.log('❌ Table "grades" does not exist!');
        } else {
            console.table(res.rows);
            // Check for exam_type_id
            const hasExamType = res.rows.some(r => r.column_name === 'exam_type_id');
            if (!hasExamType) {
                console.log('❌ Missing column: exam_type_id');
            } else {
                console.log('✅ Column exam_type_id exists');
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
