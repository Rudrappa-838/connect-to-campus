const { pool } = require('./src/config/db');
(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('ALTER TABLE hostel_payments DROP CONSTRAINT IF EXISTS hostel_payments_payment_type_check');
        await client.query(`ALTER TABLE hostel_payments ADD CONSTRAINT hostel_payments_payment_type_check CHECK (payment_type IN ('Room Rent', 'Mess Bill', 'Security Deposit', 'Other', 'Hostel Fee'))`);
        await client.query('COMMIT');
        console.log('✅ Constraint updated — Hostel Fee now allowed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
})();
