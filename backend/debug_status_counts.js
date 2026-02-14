const { pool } = require('./src/config/db');

async function debugStatusCounts() {
    const client = await pool.connect();
    try {
        console.log('🔍 Debugging Status Counts Logic...');

        // Loop through all schools to find the one with data
        let schoolsRes = await client.query("SELECT id, name FROM schools WHERE id = 1");

        for (const school of schoolsRes.rows) {
            console.log(`\n==================================================`);
            console.log(`🏫 School: ${school.name} (ID: ${school.id})`);

            // 1. MESS BILLS - RAW DATA INSPECTION
            const messRawRes = await client.query(`
                SELECT 
                    b.id, 
                    b.amount as bill_amount, 
                    pg_typeof(b.amount) as amount_type,
                    b.status as bill_status,
                    COALESCE(SUM(p.amount), 0) as paid_sum,
                    pg_typeof(COALESCE(SUM(p.amount), 0)) as paid_type,
                    (COALESCE(SUM(p.amount), 0) >= b.amount) as is_fully_paid_check,
                    (COALESCE(SUM(p.amount), 0) >= CAST(b.amount AS DECIMAL)) as is_fully_paid_cast_check
                FROM hostel_mess_bills b
                JOIN students s ON b.student_id = s.id
                LEFT JOIN hostel_payments p ON p.related_bill_id = b.id
                WHERE s.school_id = $1
                GROUP BY b.id, b.status, b.amount
            `, [school.id]);

            if (messRawRes.rows.length > 0) {
                console.log(`\n🍽️ Mess Bills Raw Data (${messRawRes.rows.length} rows):`);
                console.log(JSON.stringify(messRawRes.rows.map(r => ({
                    id: r.id,
                    bill: r.bill_amount,
                    bill_type: r.amount_type,
                    paid: r.paid_sum,
                    paid_type: r.paid_type,
                    status: r.bill_status,
                    check_raw: r.is_fully_paid_check,
                    check_cast: r.is_fully_paid_cast_check
                })), null, 2));
            } else {
                console.log('\n🍽️ No Mess Bills found for this school.');
            }

            // 2. ROOM RENT - RAW DATA INSPECTION
            const rentRawRes = await client.query(`
                SELECT 
                    a.id as alloc_id,
                    r.cost_per_term as cost, 
                    pg_typeof(r.cost_per_term) as cost_type,
                    COALESCE(SUM(p.amount), 0) as paid,
                    pg_typeof(COALESCE(SUM(p.amount), 0)) as paid_type,
                    (COALESCE(SUM(p.amount), 0) >= r.cost_per_term) as check_raw,
                    (COALESCE(SUM(p.amount), 0) >= CAST(r.cost_per_term AS DECIMAL)) as check_cast
                FROM hostel_allocations a
                JOIN hostel_rooms r ON a.room_id = r.id
                JOIN students s ON a.student_id = s.id
                LEFT JOIN hostel_payments p ON p.student_id = a.student_id AND p.payment_type = 'Room Rent'
                WHERE a.status = 'Active' AND s.school_id = $1
                GROUP BY a.id, r.cost_per_term
            `, [school.id]);

            if (rentRawRes.rows.length > 0) {
                console.log(`\n🏠 Room Rent Raw Data (${rentRawRes.rows.length} rows):`);
                console.log(JSON.stringify(rentRawRes.rows, null, 2));
            } else {
                console.log('\n🏠 No Active Allocations found for this school.');
            }
        }

    } catch (error) {
        console.error('❌ Error debugging:', error);
    } finally {
        client.release();
        pool.end();
    }
}

// Function to simulate pg_typeof if not available (shim for debugging)
async function setupTypeof(client) {
    try {
        await client.query(`
            CREATE OR REPLACE FUNCTION typeof(anyelement) RETURNS text AS $$
            SELECT pg_typeof($1)::text;
            $$ LANGUAGE sql;
        `);
    } catch (e) {
        console.log('Could not create typeof function, ignoring...');
    }
}

debugStatusCounts();
