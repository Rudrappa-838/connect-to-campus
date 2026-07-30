const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function createDebugAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        // Check if user exists
        const check = await pool.query("SELECT * FROM users WHERE email = 'debug_admin@test.com'");
        if (check.rows.length > 0) {
            const res = await pool.query(
                "UPDATE users SET password = $1 WHERE email = 'debug_admin@test.com' RETURNING id, email, role, school_id",
                [hashedPassword]
            );
            console.log('✅ Debug Admin Updated:', res.rows[0]);
        } else {
            const res = await pool.query(`
                INSERT INTO users (email, password, role, school_id)
                VALUES ('debug_admin@test.com', $1, 'SCHOOL_ADMIN', 1)
                RETURNING id, email, role, school_id;
            `, [hashedPassword]);
            console.log('✅ Debug Admin Created:', res.rows[0]);
        }

    } catch (err) {
        console.error('❌ Failed:', err);
    } finally {
        pool.end();
    }
}

createDebugAdmin();
