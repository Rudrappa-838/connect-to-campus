const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

async function seed() {
    try {
        console.log('🌱 Seeding Admin User...');
        const email = 'rudrappam798@gmail.com';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. Create a dummy school if it doesn't exist
        let schoolRes = await pool.query('SELECT * FROM schools LIMIT 1');
        let schoolId;
        
        if (schoolRes.rows.length === 0) {
            console.log('Creating a default school...');
            const insertSchool = await pool.query(`
                INSERT INTO schools (name, contact_email, subscription_status)
                VALUES ('Default School', 'admin@school.com', 'ACTIVE')
                RETURNING id
            `);
            schoolId = insertSchool.rows[0].id;
        } else {
            schoolId = schoolRes.rows[0].id;
        }

        // 2. Check if user exists
        let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userRes.rows.length === 0) {
            console.log(`Creating SCHOOL_ADMIN user ${email}...`);
            await pool.query(`
                INSERT INTO users (email, password, role, school_id)
                VALUES ($1, $2, 'SCHOOL_ADMIN', $3)
            `, [email, hashedPassword, schoolId]);
            console.log(`✅ User created! Email: ${email} | Password: ${password}`);
        } else {
            console.log(`Updating password for existing user ${email}...`);
            await pool.query(`
                UPDATE users SET password = $1, role = 'SCHOOL_ADMIN', school_id = $2 WHERE email = $3
            `, [hashedPassword, schoolId, email]);
            console.log(`✅ User updated! Email: ${email} | Password: ${password}`);
        }
    } catch (err) {
        console.error('❌ Error seeding user:', err);
    } finally {
        pool.end();
    }
}

seed();
