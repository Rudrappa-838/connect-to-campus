const { pool } = require('./src/config/db');

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'schools'
            ORDER BY column_name
        `);
        console.log("Schools table columns:");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkSchema();
