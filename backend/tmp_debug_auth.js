const { pool } = require('./src/config/db');

async function debugUser() {
    try {
        const id = 'DAD6804';
        const role = 'STAFF';

        console.log(`--- DEBUGGING FOR ID: ${id} ---`);

        // 1. Check Staff Table
        const stRes = await pool.query('SELECT * FROM staff WHERE employee_id ILIKE $1', [id]);
        if (stRes.rows.length === 0) {
            console.log('No staff found with this ID');
        } else {
            const staff = stRes.rows[0];
            console.log('Staff Found:', {
                id: staff.id,
                employee_id: staff.employee_id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                school_id: staff.school_id
            });

            // 2. Check Users Table by Email
            if (staff.email) {
                const uRes = await pool.query('SELECT * FROM users WHERE email = $1', [staff.email]);
                if (uRes.rows.length === 0) {
                    console.log(`No user found with email: ${staff.email}`);
                } else {
                    console.log('User Found by Email:', uRes.rows.map(u => ({ id: u.id, email: u.email, role: u.role, school_id: u.school_id })));
                }
            }

            // 3. Check Users Table by Synthetic Email
            const synthetic = `${id.toLowerCase()}@staff.school.com`;
            const sRes = await pool.query('SELECT * FROM users WHERE email = $1', [synthetic]);
            if (sRes.rows.length > 0) {
                console.log('User Found by Synthetic:', sRes.rows.map(u => ({ id: u.id, email: u.email, role: u.role, school_id: u.school_id })));
            } else {
                console.log(`No user found with synthetic email: ${synthetic}`);
            }
        }
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugUser();
