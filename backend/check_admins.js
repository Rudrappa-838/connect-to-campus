const { pool } = require('./src/config/db');
require('dotenv').config();

async function checkSuperAdmins() {
    try {
        const result = await pool.query("SELECT email, role FROM users WHERE role = 'SUPER_ADMIN'");
        console.log("\n--- Super Admins in Database ---");
        if (result.rows.length === 0) {
            console.log("No Super Admins found!");
        } else {
            result.rows.forEach(user => {
                console.log(`Email: ${user.email} | Role: ${user.role}`);
            });
        }
        console.log("--------------------------------\n");
    } catch (err) {
        console.error("Error connecting to DB:", err.message);
    } finally {
        pool.end();
    }
}

checkSuperAdmins();
