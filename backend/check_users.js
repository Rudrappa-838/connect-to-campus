const { pool } = require('./src/config/db'); 
async function run() { 
    try {
        const res = await pool.query("SELECT linked_id, COUNT(*) FROM users WHERE role = 'STUDENT' GROUP BY linked_id HAVING COUNT(*) > 1"); 
        console.log('Duplicate students in users table:', res.rows); 
        
        const res2 = await pool.query("SELECT linked_id, COUNT(*) FROM users WHERE role = 'TEACHER' GROUP BY linked_id HAVING COUNT(*) > 1"); 
        console.log('Duplicate teachers in users table:', res2.rows); 
        
        const res3 = await pool.query("SELECT linked_id, COUNT(*) FROM users WHERE role NOT IN ('STUDENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN') GROUP BY linked_id HAVING COUNT(*) > 1"); 
        console.log('Duplicate staff in users table:', res3.rows); 
    } catch (e) {
        console.error(e);
    } finally {
        pool.end(); 
    }
} 
run();
