const { pool } = require('./src/config/db');

async function run() {
    try {
        const patterns = ['%dad8663%', '%das5778%', '%DAD8663%', '%DAS5778%'];
        for (const p of patterns) {
            console.log(`Searching users for pattern: ${p}`);
            const res = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [p]);
            console.log('Results:', res.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
