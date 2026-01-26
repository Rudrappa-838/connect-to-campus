const { pool } = require('./src/config/db');

async function checkTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📊 Existing Tables:', res.rows.map(r => r.table_name));
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        pool.end();
    }
}

checkTables();
