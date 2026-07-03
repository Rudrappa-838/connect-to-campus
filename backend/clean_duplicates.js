const { pool } = require('./src/config/db');

async function cleanDuplicates() {
    console.log('Cleaning duplicate users...');
    try {
        const roles = ['STUDENT', 'TEACHER', 'LIBRARIAN', 'DRIVER', 'STAFF', 'ACCOUNTANT']; // add relevant roles
        
        for (const role of roles) {
            const res = await pool.query(`
                DELETE FROM users
                WHERE role = $1 AND id NOT IN (
                    SELECT MIN(id)
                    FROM users
                    WHERE role = $1
                    GROUP BY linked_id
                ) AND linked_id IS NOT NULL
            `, [role]);
            console.log(`Deleted ${res.rowCount} duplicate ${role} users.`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
cleanDuplicates();
