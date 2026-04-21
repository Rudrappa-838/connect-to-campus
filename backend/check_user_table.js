const { pool } = require('./src/config/db');

async function checkUserTable() {
    try {
        console.log(`Checking users table...`);
        
        // Find users with '901408' anywhere (email or ID)
        const userRes = await pool.query(
            "SELECT id, email, role, must_change_password FROM users WHERE email ILIKE '%901408%' OR CAST(id AS TEXT) = '901408'"
        );
        
        console.log(`Found ${userRes.rows.length} Potential Users:`);
        console.table(userRes.rows);
        
        // Find most recent users
        const recentRes = await pool.query(
            "SELECT id, email, role, must_change_password FROM users ORDER BY id DESC LIMIT 20"
        );
        console.log('\nMost recent users:');
        console.table(recentRes.rows);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkUserTable();
