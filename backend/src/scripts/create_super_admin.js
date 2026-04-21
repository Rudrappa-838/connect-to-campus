const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

async function createSuperAdmin() {
    const client = await pool.connect();
    try {
        console.log("Creating/Updating Super Admin user...\n");

        // Get credentials from command line or use defaults
        const email = process.argv[2] || 'superadmin@example.com';
        const password = process.argv[3] || 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Super Admin doesn't need a school_id
        await client.query(`
            INSERT INTO users (email, password, role, school_id)
            VALUES ($1, $2, 'SUPER_ADMIN', NULL)
            ON CONFLICT (email) 
            DO UPDATE SET password = $2, role = 'SUPER_ADMIN'
        `, [email, hashedPassword]);

        console.log("✅ Super Admin Created/Updated Successfully!");
        console.log("\n--- SUPER ADMIN CREDENTIALS ---");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`Role: SUPER_ADMIN`);
        console.log(`Login URL: http://localhost:5173/super-admin-login`);
        console.log("--------------------------------\n");

    } catch (error) {
        console.error("ERROR:", error);
    } finally {
        client.release();
        process.exit();
    }
}

createSuperAdmin();
