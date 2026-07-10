const { pool } = require('./src/config/db.js');
async function checkMore() {
    const client = await pool.connect();
    try {
        const students = await client.query('SELECT id, admission_number, name FROM students ORDER BY id DESC LIMIT 5');
        console.log('Latest Students:', students.rows);
        
        const staff = await client.query('SELECT id, employee_id, role, name FROM staff ORDER BY id DESC LIMIT 5');
        console.log('Latest Staff:', staff.rows);
    } catch(e) { console.error(e); } finally { client.release(); pool.end(); }
}
checkMore();
