const { pool } = require('./src/config/db');

async function testUsers() {
    const res = await pool.query("SELECT u.email, u.role, u.linked_id, s.admission_no FROM users u LEFT JOIN students s ON u.linked_id = s.id WHERE u.role = 'STUDENT' LIMIT 5");
    console.log("Sample Users/Students:");
    console.table(res.rows);
    
    // Check if there are ANY students where users.email does not match admission_no
    const mismatch = await pool.query("SELECT u.email, s.admission_no FROM users u JOIN students s ON u.linked_id = s.id WHERE u.role = 'STUDENT' AND u.email != LOWER(s.admission_no) LIMIT 5");
    console.log("\nMismatched Users/Students (if any):");
    console.table(mismatch.rows);
    
    pool.end();
}

testUsers();
