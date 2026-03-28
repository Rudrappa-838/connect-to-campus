const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function fix() {
    try {
        console.log('Starting manual fix for TUS2691...');
        const hash = await bcrypt.hash('123456', 10);
        
        // 1. Ensure the identifier is exactly 'tus2691' (lowercase, trimmed)
        // 2. Ensure password is '123456'
        // 3. Ensure must_change_password is TRUE
        const result = await pool.query(
            "UPDATE users SET email = $1, password = $2, must_change_password = TRUE WHERE role = 'STUDENT' AND (email ILIKE 'tus%' OR email = 'mrudru7@gmail.com')",
            ['tus2691', hash]
        );
        
        if (result.rowCount > 0) {
            console.log('✅ SUCCESS: Account TUS2691 has been hard-reset to password 123456');
        } else {
            console.log('❌ FAILED: No matching student account found to update');
        }
        process.exit(0);
    } catch (e) {
        console.error('Error during fix:', e);
        process.exit(1);
    }
}

fix();
