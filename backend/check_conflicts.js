const { pool } = require('./src/config/db');

async function debugConflict() {
    try {
        console.log('🔍 Checking for email conflicts in users linked to deleted schools...');
        
        const res = await pool.query(`
            SELECT u.id, u.email, u.role, u.school_id, s.name as school_name, s.status as school_status
            FROM users u
            LEFT JOIN schools s ON u.school_id = s.id
            WHERE s.status = 'Deleted'
        `);
        
        if (res.rows.length === 0) {
            console.log('No users found linked to deleted schools.');
        } else {
            console.log(`Found ${res.rows.length} users linked to deleted schools:`);
            console.table(res.rows);
        }

        // Also check if any adminEmail from recent failed attempts exists
        // (User might be trying a specific email)
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

debugConflict();
