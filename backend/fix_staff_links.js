const { pool } = require('./src/config/db');

async function checkAndFix() {
    try {
        const res = await pool.query(`
            SELECT id, email, role, linked_id 
            FROM users 
            WHERE role IN ('STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN') 
            AND linked_id IS NULL
        `);
        
        console.log(`Found ${res.rows.length} staff users with missing linked_id.`);
        
        for (const user of res.rows) {
            console.log(`Checking user: ${user.email} (${user.role})`);
            
            // Try match by email
            let staffRes = await pool.query('SELECT id FROM staff WHERE LOWER(email) = LOWER($1)', [user.email]);
            
            if (staffRes.rows.length === 0) {
                // Try match by employee ID (extract from email if synthetic)
                const empId = user.email.includes('@') ? user.email.split('@')[0] : user.email;
                staffRes = await pool.query('SELECT id FROM staff WHERE employee_id ILIKE $1', [empId]);
            }
            
            if (staffRes.rows.length > 0) {
                const staffId = staffRes.rows[0].id;
                await pool.query('UPDATE users SET linked_id = $1 WHERE id = $2', [staffId, user.id]);
                console.log(`Successfully linked user ${user.email} to staff ID ${staffId}`);
            } else {
                console.log(`Could NOT find a staff record for user ${user.email}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkAndFix();
