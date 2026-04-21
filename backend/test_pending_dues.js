const { pool } = require('./src/config/db');

async function testPendingDues() {
    try {
        console.log('Testing Simplified getPendingDues logic...');

        // Mock School ID - assuming 1 or deriving from an existing user
        const schoolQuery = await pool.query('SELECT id FROM schools LIMIT 1');
        if (schoolQuery.rows.length === 0) {
            console.error("No school found!");
            return;
        }
        const schoolId = schoolQuery.rows[0].id;
        console.log('Using School ID:', schoolId);

        // 1. Pending Mess Bills
        let messQuery = `
            SELECT b.id, b.student_id, s.name, s.admission_no, b.amount, b.month, b.year 
            FROM hostel_mess_bills b 
            JOIN students s ON b.student_id = s.id 
            WHERE b.status = 'Pending' AND s.school_id = $1 AND (s.status IS NULL OR s.status != 'Deleted')
        `;
        messQuery += ` ORDER BY b.year DESC, b.month DESC`;

        try {
            const messRes = await pool.query(messQuery, [schoolId]);
            console.log(`Mess Bills Found: ${messRes.rows.length}`);
        } catch (e) {
            console.error("Mess Query Failed:", e);
        }

        // 2. Pending Room Rent (Simplified CAST)
        const rentQuery = `
            SELECT a.id as allocation_id, s.id as student_id, s.name, s.admission_no, 
                   r.cost_per_term, r.room_number,
                   COALESCE(SUM(p.amount), 0) as paid_amount
            FROM hostel_allocations a
            JOIN students s ON a.student_id = s.id
            JOIN hostel_rooms r ON a.room_id = r.id
            LEFT JOIN hostel_payments p ON s.id = p.student_id AND p.payment_type = 'Room Rent'
            WHERE (a.status = 'Active' OR a.status = 'Vacated') 
              AND s.school_id = $1 
              AND (s.status IS NULL OR s.status != 'Deleted')
            GROUP BY a.id, s.id, s.name, s.admission_no, r.id, r.cost_per_term, r.room_number
            HAVING COALESCE(SUM(p.amount), 0) < CAST(r.cost_per_term AS NUMERIC)
        `;

        try {
            const rentRes = await pool.query(rentQuery, [schoolId]);
            console.log(`Rent Dues Found: ${rentRes.rows.length}`);
            rentRes.rows.forEach(r => {
                console.log(`- Room ${r.room_number}: ${r.name}, Cost: ${r.cost_per_term}, Paid: ${r.paid_amount}`);
            });
        } catch (err) {
            console.error('Rent Query Failed:', err);
        }

    } catch (error) {
        console.error('General Error:', error);
    } finally {
        pool.end();
    }
}

testPendingDues();
