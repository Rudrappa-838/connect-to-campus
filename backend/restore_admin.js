const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function restoreAdmin() {
    try {
        const schoolCode = '672691';
        console.log(`Looking for school with code: ${schoolCode}...`);
        
        const schoolRes = await pool.query('SELECT id, contact_email, name FROM schools WHERE school_code = $1', [schoolCode]);
        
        if (schoolRes.rows.length === 0) {
            console.log("School not found!");
            return;
        }

        const school = schoolRes.rows[0];
        console.log(`Found school: ${school.name}`);

        const adminRes = await pool.query('SELECT id FROM users WHERE school_id = $1 AND role = $2', [school.id, 'SCHOOL_ADMIN']);
        
        if (adminRes.rows.length > 0) {
            console.log("School Admin user already exists. If you still can't login, try resetting the password.");
            return;
        }

        console.log("School Admin user is missing. Recreating it now...");
        
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        
        await pool.query(
            `INSERT INTO users (email, password, role, school_id, must_change_password) 
             VALUES ($1, $2, 'SCHOOL_ADMIN', $3, FALSE)`,
            [school.contact_email, hashedPassword, school.id]
        );

        console.log(`✅ Success! Admin account recreated.`);
        console.log(`You can now log in with:`);
        console.log(`ID/Email: ${schoolCode}  OR  ${school.contact_email}`);
        console.log(`Password: Admin@123`);

    } catch (e) {
        console.error("Error restoring admin:", e);
    } finally {
        pool.end();
    }
}

restoreAdmin();
