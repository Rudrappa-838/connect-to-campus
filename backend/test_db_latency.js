const { pool } = require('./src/config/db');

async function testLatency() {
    console.log('Testing DB Latency...');
    const start = Date.now();
    try {
        const res = await pool.query('SELECT 1');
        const end = Date.now();
        console.log(`✅ SELECT 1 took ${end - start}ms`);

        const start2 = Date.now();
        const res2 = await pool.query('SELECT count(*) FROM users');
        const end2 = Date.now();
        console.log(`✅ SELECT COUNT(*) FROM users took ${end2 - start2}ms`);
    } catch (e) {
        console.error('❌ DB Test failed:', e);
    } finally {
        await pool.end();
    }
}

testLatency();
