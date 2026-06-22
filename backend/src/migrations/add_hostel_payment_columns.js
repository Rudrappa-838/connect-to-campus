// Migration: Add payment_status, due_date, paid_amount to hostel_payments
// Run this once: node backend/src/migrations/add_hostel_payment_columns.js

const { pool } = require('../config/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add columns if they don't exist
        await client.query(`
            ALTER TABLE hostel_payments
                ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'Paid'
                    CHECK (payment_status IN ('Assigned', 'Paid', 'Partial', 'Waived')),
                ADD COLUMN IF NOT EXISTS due_date DATE,
                ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2)
        `);

        // Backfill: existing rows are all confirmed payments, mark them Paid
        await client.query(`
            UPDATE hostel_payments SET payment_status = 'Paid', paid_amount = amount
            WHERE payment_status IS NULL OR payment_status = 'Paid'
        `);

        await client.query('COMMIT');
        console.log('✅ hostel_payments migration complete');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err.message);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
