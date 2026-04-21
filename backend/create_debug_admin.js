const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function createDebugAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        // Upsert debug admin
        const res = await pool.query(`
            INSERT INTO users (email, password, role, school_id)
            VALUES ('debug_admin@test.com', $1, 'SCHOOL_ADMIN', 1)
            ON CONFLICT (email) DO UPDATE 
            SET password = $1
            RETURNING id, email, role, school_id;
        `, [hashedPassword]);

        console.log('✅ Debug Admin Ready:', res.rows[0]);

    } catch (err) {
        console.error('❌ Failed:', err);
    } finally {
        pool.end();
    }
}

createDebugAdmin();
