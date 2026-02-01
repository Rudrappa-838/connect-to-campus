const { pool } = require('./src/config/db');

async function debugHostelDues() {
    try {
        console.log('--- DEBUGGING HOSTEL DUES ---');

        // 1. Get School ID
        const schoolRes = await pool.query('SELECT id FROM schools LIMIT 1');
        if (schoolRes.rows.length === 0) { console.log('No schools found'); return; }
        const schoolId = schoolRes.rows[0].id;
        console.log(`Using School ID: ${schoolId}`);

        // 2. Check Mess Bills
        console.log('\n--- Checking Pending Mess Bills ---');
        const messQuery = `
            SELECT b.id, s.name, b.amount, b.status 
            FROM hostel_mess_bills b 
            JOIN students s ON b.student_id = s.id 
            WHERE s.school_id = $1
        `;
        const messRes = await pool.query(messQuery, [schoolId]);
        console.log(`Total Mess Bills Found: ${messRes.rows.length}`);
        messRes.rows.forEach(r => console.log(`  - ${r.name}: ${r.amount} (${r.status})`));

        // 3. Check Room Rent Dues
        console.log('\n--- Checking Room Rent Dues ---');
        const rentQuery = `
             SELECT a.id as allocation_id, s.name, r.room_number, r.cost_per_term,
                   (SELECT COALESCE(SUM(amount), 0) FROM hostel_payments WHERE student_id = s.id AND payment_type = 'Room Rent') as paid_amount
            FROM hostel_allocations a
            JOIN students s ON a.student_id = s.id
            JOIN hostel_rooms r ON a.room_id = r.id
            WHERE (a.status = 'Active' OR a.status = 'Vacated') 
              AND s.school_id = $1
        `;
        const rentRes = await pool.query(rentQuery, [schoolId]);
        console.log(`Total Hostellers Found (Active/Vacated): ${rentRes.rows.length}`);

        rentRes.rows.forEach(row => {
            const cost = parseFloat(row.cost_per_term || 0);
            const paid = parseFloat(row.paid_amount || 0);
            const due = cost - paid;
            console.log(`  - ${row.name} (Room ${row.room_number}): Cost ${cost}, Paid ${paid}, Due ${due}`);
            if (due > 0) console.log(`    -> SHOULD APPEAR IN LIST`);
            else console.log(`    -> PAID OFF`);
        });

    } catch (err) {
        console.error('DEBUG ERROR:', err);
    } finally {
        pool.end();
    }
}

debugHostelDues();
