const { pool } = require('./src/config/db');

async function releaseDeletedEmails() {
    try {
        console.log("Renaming emails of deleted schools to free them up...");
        const res = await pool.query(`
            UPDATE schools 
            SET contact_email = 'deleted_' || id || '_' || contact_email 
            WHERE status = 'Deleted' AND contact_email NOT LIKE 'deleted_%'
            RETURNING id, name, contact_email
        `);
        console.log("Updated schools:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

releaseDeletedEmails();
