const { pool } = require('./src/config/db');

async function debugHostelReport() {
    const client = await pool.connect();
    try {
        console.log('🔍 Generating Comprehensive Hostel Report...');

        const schoolsRes = await client.query("SELECT id, name FROM schools");
        console.log(`🏫 Found ${schoolsRes.rows.length} schools.`);

        for (const school of schoolsRes.rows) {
            console.log(`\n==================================================`);
            console.log(`🏫 School: ${school.name} (ID: ${school.id})`);
            console.log(`==================================================`);

            // 1. Allocations
            const allocRes = await client.query(`
                SELECT a.status, count(*) as count 
                FROM hostel_allocations a 
                JOIN students s ON a.student_id = s.id 
                WHERE s.school_id = $1 
                GROUP BY a.status
            `, [school.id]);
            console.log('📦 Allocations:', allocRes.rows);

            // 2. Mess Bills
            const messRes = await client.query(`
                SELECT b.status, count(*) as count 
                FROM hostel_mess_bills b 
                JOIN students s ON b.student_id = s.id 
                WHERE s.school_id = $1 
                GROUP BY b.status
            `, [school.id]);
            console.log('🍽️ Mess Bills:', messRes.rows);

            // 3. Stats Query (Rent)
            const rentStatusRes = await client.query(`
                SELECT 
                    SUM(cost) as total_expected_rent,
                    count(CASE WHEN paid >= cost THEN 1 END) as fully_paid,
                    count(CASE WHEN paid > 0 AND paid < cost THEN 1 END) as partially_paid,
                    count(CASE WHEN paid = 0 THEN 1 END) as unpaid
                FROM (
                    SELECT 
                        r.cost_per_term as cost, 
                        COALESCE(SUM(p.amount), 0) as paid
                    FROM hostel_allocations a
                    JOIN hostel_rooms r ON a.room_id = r.id
                    JOIN students s ON a.student_id = s.id
                    LEFT JOIN hostel_payments p ON p.student_id = a.student_id AND p.payment_type = 'Room Rent'
                    WHERE a.status = 'Active' AND s.school_id = $1
                    GROUP BY a.id, r.cost_per_term
                ) as rent_Derived
            `, [school.id]);
            console.log('📊 Stats (Rent):', rentStatusRes.rows[0]);

            // 4. Pending Dues Query (Rent Count)
            const pendingRentRes = await client.query(`
                SELECT count(*) as count
                FROM hostel_allocations a
                JOIN students s ON a.student_id = s.id
                JOIN hostel_rooms r ON a.room_id = r.id
                WHERE (a.status = 'Active' OR a.status = 'Vacated') 
                  AND s.school_id = $1 
                  AND (SELECT COALESCE(SUM(amount), 0) FROM hostel_payments WHERE student_id = s.id AND payment_type = 'Room Rent') < CAST(r.cost_per_term AS DECIMAL)
            `, [school.id]);
            console.log('⚠️ Pending Rent Dues (Count):', pendingRentRes.rows[0].count);
        }

    } catch (error) {
        console.error('❌ Error generating report:', error);
    } finally {
        client.release();
        pool.end();
    }
}

debugHostelReport();
