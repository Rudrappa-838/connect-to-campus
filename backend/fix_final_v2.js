const { pool } = require('./src/config/db');

async function fix() {
    try {
        console.log('🚀 Starting Final Database Repair...');

        // 1. Fix Fee Payments (Confirmed missing 'remarks')
        console.log('... Checking Fee Payments');
        await pool.query('ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS remarks TEXT');
        await pool.query('ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)');
        await pool.query('ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(50)');
        await pool.query('ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        await pool.query('ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

        // 2. Fix Library Transactions (Likely missing 'return_date' causing 500 on return)
        console.log('... Checking Library Transactions');
        await pool.query('ALTER TABLE library_transactions ADD COLUMN IF NOT EXISTS return_date TIMESTAMP');
        await pool.query('ALTER TABLE library_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'Issued\'');

        // 3. Fix Library Books (Just in case)
        console.log('... Checking Library Books');
        await pool.query('ALTER TABLE library_books ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'Available\'');

        console.log('✅ ALL SYSTEMS REPAIRED. YOU ARE GOOD TO GO!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

fix();
