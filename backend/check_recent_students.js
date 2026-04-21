const { pool } = require('./src/config/db');

async function checkRecentStudents() {
    try {
        console.log(`Checking recent students...`);
        
        // Find recent students
        const res = await pool.query('SELECT admission_no, email, name FROM students ORDER BY id DESC LIMIT 5');
        console.table(res.rows);
        
        // Find recent users for those students
        if (res.rows.length > 0) {
            const admissionNos = res.rows.map(r => r.admission_no.toLowerCase());
            console.log('\nChecking corresponding users table entries:');
            const userRes = await pool.query(
                "SELECT id, email, role, must_change_password FROM users WHERE (email = ANY($1)) AND role = 'STUDENT'",
                [admissionNos]
            );
            console.table(userRes.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkRecentStudents();
