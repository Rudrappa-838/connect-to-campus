const { pool } = require('./src/config/db');

async function checkSchools() {
    try {
        const res = await pool.query("SELECT id, name, contact_email, status FROM schools ORDER BY id");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkSchools();
