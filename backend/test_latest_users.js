const { pool } = require('./src/config/db.js');
async function checkUsers() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, email, role, created_at FROM users ORDER BY id DESC LIMIT 5');
        console.log('Latest Users:', res.rows);
        
        const res2 = await client.query('SELECT id, employee_id, email, name FROM teachers ORDER BY id DESC LIMIT 5');
        console.log('Latest Teachers:', res2.rows);
    } catch(e) { console.error(e); } finally { client.release(); pool.end(); }
}
checkUsers();
