const { pool } = require('./src/config/db');

async function resetHostelData() {
    const client = await pool.connect();
    try {
        console.log('🧹 Starting Hostel Data Cleanup...');
        await client.query('BEGIN');

        // 1. Clear Payments
        console.log('Deleting hostel_payments...');
        await client.query('DELETE FROM hostel_payments');

        // 2. Clear Mess Bills
        console.log('Deleting hostel_mess_bills...');
        await client.query('DELETE FROM hostel_mess_bills');

        // 3. Clear Allocations (To prevent old 'Vacated' students from showing as having dues)
        console.log('Deleting hostel_allocations...');
        await client.query('DELETE FROM hostel_allocations');

        // Reset Sequences (Optional, for clean IDs)
        await client.query('ALTER SEQUENCE hostel_payments_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE hostel_mess_bills_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE hostel_allocations_id_seq RESTART WITH 1');

        await client.query('COMMIT');
        console.log('✅ Hostel Finance & Allocation Data Cleared Successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error clearing data:', error);
    } finally {
        client.release(); // Close the client connection
        pool.end();       // Close the pool
    }
}

resetHostelData();
