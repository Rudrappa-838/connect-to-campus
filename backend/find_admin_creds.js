const { pool } = require('./src/config/db');

async function findAdmin() {
    try {
        const res = await pool.query("SELECT email, role, school_id FROM users WHERE role = 'SCHOOL_ADMIN' LIMIT 1");
        if (res.rows.length > 0) {
            console.log('✅ Found Admin:', res.rows[0]);
        } else {
            console.log('❌ No School Admin found.');
            const anyUser = await pool.query("SELECT email, role, school_id FROM users LIMIT 1");
            console.log('Fallback Any User:', anyUser.rows[0]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

findAdmin();
