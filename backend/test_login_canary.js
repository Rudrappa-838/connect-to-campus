const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function testLoginLogic() {
    const email = 'superadmin@example.com';
    const password = 'admin123';
    const role = 'SUPER_ADMIN';

    try {
        console.log(`Testing login for ${email} / ${password}...`);
        
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
        
        if (result.rows.length === 0) {
            console.log("❌ User not found in DB");
            return;
        }

        const user = result.rows[0];
        console.log(`Found user: ${user.email}, Role: ${user.role}`);

        const validPassword = await bcrypt.compare(password, user.password);
        console.log(`Password Valid: ${validPassword}`);

        if (user.role !== role) {
            console.log(`❌ Role mismatch: DB role is ${user.role}, requested was ${role}`);
        } else {
            console.log("✅ Role matches");
        }

        if (validPassword && user.role === role) {
            console.log("🚀 LOGIN SUCCESSFUL IN REPLICA LOGIC");
        } else {
            console.log("💀 LOGIN FAILED");
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        pool.end();
    }
}

testLoginLogic();
