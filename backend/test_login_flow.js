const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function testLogin(inputId, role) {
    let email = inputId.trim();
    let checkEmails = [email, email.toLowerCase()];
    
    if (role === 'STUDENT') {
        checkEmails.push(`${email.toLowerCase()}@student.school.com`);
        const sRes = await pool.query('SELECT email FROM students WHERE admission_no ILIKE $1', [email]);
        if (sRes.rows.length > 0) checkEmails.push(sRes.rows[0].email);
    }
    
    console.log('Check Emails:', checkEmails);
    
    const result = await pool.query(`
        SELECT u.* 
        FROM users u 
        WHERE LOWER(u.email) = ANY($1::text[])
    `, [checkEmails.filter(Boolean).map(e => e.trim().toLowerCase())]);
    
    console.log('Found users count:', result.rows.length);
    if (result.rows.length > 0) {
        console.log('User emails found in DB:', result.rows.map(r => r.email));
        
        const priorityMatch = result.rows.find(u => 
            u.email.toLowerCase().startsWith(email.toLowerCase() + '@') ||
            u.email.toLowerCase() === email.toLowerCase()
        );
        console.log('Priority Match selected:', priorityMatch ? priorityMatch.email : 'None (falling back to first)');
    }
    pool.end();
}

// Test with a sample ID from the DB
pool.query('SELECT admission_no FROM students LIMIT 1').then(res => {
    if (res.rows.length > 0) {
        const sampleId = res.rows[0].admission_no;
        console.log('Testing with sample ID:', sampleId);
        testLogin(sampleId, 'STUDENT');
    } else {
        console.log('No students found');
        pool.end();
    }
});
