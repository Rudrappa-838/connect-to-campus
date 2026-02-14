const { pool } = require('./src/config/db');

async function debugHostelStats() {
    const client = await pool.connect();
    try {
        console.log('🔍 Starting Hostel Stats Debug...');

        // Focus on School ID 1
        const schoolId = 1;
        console.log(`\n--- Checking School ID: ${schoolId} ---`);

        // Run the Exact Stats Query
        const rentStatusRes = await client.query(`
            SELECT 
                SUM(cost) as total_expected_rent,
                count(CASE WHEN paid >= cost THEN 1 END) as fully_paid,
                count(CASE WHEN paid > 0 AND paid < cost THEN 1 END) as partially_paid,
                count(CASE WHEN paid = 0 THEN 1 END) as unpaid,
                json_agg(json_build_object('alloc_id', alloc_id, 'cost', cost, 'paid', paid)) as details
            FROM (
                SELECT 
                    a.id as alloc_id,
                    r.cost_per_term as cost, 
                    COALESCE(SUM(p.amount), 0) as paid
                FROM hostel_allocations a
                JOIN hostel_rooms r ON a.room_id = r.id
                JOIN students s ON a.student_id = s.id
                LEFT JOIN hostel_payments p ON p.student_id = a.student_id AND p.payment_type = 'Room Rent'
                WHERE a.status = 'Active' AND s.school_id = $1
                GROUP BY a.id, r.cost_per_term
            ) as rent_Derived
        `, [schoolId]);

        console.log('✅ Stats Result:', JSON.stringify(rentStatusRes.rows[0], null, 2));

    } catch (error) {
        console.error('❌ Error debugging stats:', error);
    } finally {
        client.release();
        pool.end();
    }
}

debugHostelStats();
