const { pool } = require('./src/config/db');

async function debugStudentLogin() {
    try {
        console.log('--- DEBUG STUDENT/USER LOGIN ---');
        
        // Find most recent student
        const studentRes = await pool.query('SELECT admission_no, email, name, class_id from students ORDER BY id DESC LIMIT 1');
        if (studentRes.rows.length === 0) {
            console.log('No students found.');
            return;
        }
        
        const student = studentRes.rows[0];
        console.log('Student found:', student);
        
        // Potential login emails/ids
        const variants = [
            student.admission_no,
            student.admission_no.toLowerCase(),
            student.email,
            student.email?.toLowerCase(),
            `${student.admission_no.toLowerCase()}@student.school.com`
        ].filter(Boolean);
        
        console.log('Checking users table for these identifiers:', variants);
        
        const userRes = await pool.query(
            "SELECT id, email, role, must_change_password from users WHERE email = ANY($1) AND role = 'STUDENT'",
            [variants]
        );
        
        if (userRes.rows.length === 0) {
            console.log('❌ NO USER FOUND in users table for any of these variants!');
            // Check all students in users table
            const allUsers = await pool.query("SELECT email, role FROM users WHERE role = 'STUDENT' ORDER BY id DESC LIMIT 5");
            console.log('Recent STUDENT users in table:');
            console.table(allUsers.rows);
        } else {
            console.log('✅ Found matching user(s):');
            console.table(userRes.rows);
        }
        
    } catch (e) {
        console.error('Error debugging student login:', e);
    } finally {
        process.exit(0);
    }
}

debugStudentLogin();
