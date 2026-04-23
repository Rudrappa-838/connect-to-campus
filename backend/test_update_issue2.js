const { pool } = require('./src/config/db');

async function checkDups() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT class_id, section_id, roll_number, COUNT(*) 
            FROM students 
            WHERE status != 'Deleted' OR status IS NULL
            GROUP BY class_id, section_id, roll_number 
            HAVING COUNT(*) > 1
        `);
        console.log('Duplicates found via Group:', res.rows.length);
        if (res.rows.length > 0) {
            console.log(res.rows.slice(0, 5));
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
checkDups();
