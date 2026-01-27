const { pool } = require('./src/config/db');
const fs = require('fs');

async function runSql() {
    try {
        const sql = fs.readFileSync('fix_users.sql', 'utf8');
        console.log('Running SQL Fix...');
        await pool.query(sql);
        console.log('SQL Executed.');
    } catch (e) {
        console.error('FAIL:', e.message);
    } finally {
        pool.end();
    }
}

runSql();
