const { pool } = require('./src/config/db');

async function fix() {
    try {
        console.log('🚀 Starting Final System Repair...');

        // 1. Fix Library Data (Reset Stuck Books)
        console.log('📚 Fixing Library Data...');
        await pool.query("UPDATE library_books SET status = 'Available'");
        console.log('✅ Library Books Reset to Available');

        // 2. Fix Salary Table Schema
        console.log('💰 Fixing Salary Table...');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS employee_id INTEGER');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50)');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS school_id INTEGER');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS month INTEGER');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS year INTEGER');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2)');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        await pool.query('ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50)');

        console.log('🎉 ALL ISSUES RESOLVED! You can now use Library and Salary modules.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

fix();
