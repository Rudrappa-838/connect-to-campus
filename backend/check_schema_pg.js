const { pool } = require('./src/config/db');

async function test() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('schools', 'exams', 'exam_schedules', 'students')
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
test();
