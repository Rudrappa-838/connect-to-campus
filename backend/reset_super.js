const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetSuperAdmin() {
    try {
        const email = 'superadmin@example.com';
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const result = await pool.query(
            "UPDATE users SET password = $1 WHERE email = $2 AND role = 'SUPER_ADMIN' RETURNING id",
            [hashedPassword, email]
        );

        if (result.rows.length > 0) {
            console.log(`✅ Password successfully reset for ${email} to ${newPassword}`);
        } else {
            console.log(`❌ Could not find SUPER_ADMIN with email ${email}. Attempting to create one...`);
            await pool.query(
                "INSERT INTO users (email, password, role, school_id) VALUES ($1, $2, 'SUPER_ADMIN', NULL)",
                [email, hashedPassword]
            );
            console.log(`✅ Created new SUPER_ADMIN: ${email} with password: ${newPassword}`);
        }
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        pool.end();
    }
}

resetSuperAdmin();
