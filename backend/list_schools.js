const { pool } = require('./src/config/db');

async function listSchools() {
    try {
        console.log(`Listing 10 schools...`);
        const res = await pool.query('SELECT id, name, school_code, contact_email FROM schools LIMIT 10');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

listSchools();
