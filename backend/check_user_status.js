const { pool } = require('./src/config/db');

async function checkUserStatus() {
    try {
        const schoolCode = '901408';
        console.log(`Checking user tied to school code: ${schoolCode}`);
        
        // Find the school
        const schoolRes = await pool.query('SELECT id, contact_email FROM schools WHERE school_code = $1', [schoolCode]);
        if (schoolRes.rows.length === 0) {
            console.log('School not found.');
            return;
        }
        
        const schoolId = schoolRes.rows[0].id;
        const contactEmail = schoolRes.rows[0].contact_email;
        console.log(`School ID: ${schoolId}, Contact Email: ${contactEmail}`);
        
        // Find users for this school
        const userRes = await pool.query(
            "SELECT id, email, role, must_change_password FROM users WHERE (email = $1 OR email = $2 OR school_id = $3) AND role = 'SCHOOL_ADMIN'",
            [schoolCode, contactEmail, schoolId]
        );
        
        console.log(`Found ${userRes.rows.length} Potential School Admin Users:`);
        console.table(userRes.rows);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkUserStatus();
