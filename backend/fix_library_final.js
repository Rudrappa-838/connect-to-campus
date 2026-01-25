const { pool } = require('./src/config/db');

async function fixLibrary() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing Library Schema and Data...');
        await client.query('BEGIN');

        // 1. Fix library_books Table
        console.log('Updating library_books schema...');
        await client.query(`
            ALTER TABLE library_books 
            ALTER COLUMN status SET DEFAULT 'Available';
        `);

        // Fix existing NULL statuses
        await client.query(`
            UPDATE library_books SET status = 'Available' WHERE status IS NULL;
        `);

        // 2. Fix library_transactions Table
        console.log('Updating library_transactions schema...');
        await client.query(`
            ALTER TABLE library_transactions 
            ALTER COLUMN issue_date SET DEFAULT CURRENT_TIMESTAMP,
            ALTER COLUMN status SET DEFAULT 'Issued',
            ALTER COLUMN fine_amount SET DEFAULT 0.00;
        `);

        // Fix existing NULL issue_dates (useid as proxy if needed, or just now)
        await client.query(`
            UPDATE library_transactions SET issue_date = CURRENT_TIMESTAMP WHERE issue_date IS NULL;
        `);

        // Fix existing NULL statuses in transactions
        // Heuristic: If return_date is set, it's 'Returned', else 'Issued'
        await client.query(`
            UPDATE library_transactions 
            SET status = CASE 
                WHEN return_date IS NOT NULL THEN 'Returned' 
                ELSE 'Issued' 
            END
            WHERE status IS NULL;
        `);

        // Important: Sync library_books status with transactions
        // If a transaction is 'Issued', the book MUST be 'Issued'
        console.log('Syncing book status with active transactions...');
        await client.query(`
            UPDATE library_books
            SET status = 'Issued'
            WHERE id IN (SELECT book_id FROM library_transactions WHERE status = 'Issued');
        `);

        console.log('✅ Library repair completed successfully!');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing library:', error);
    } finally {
        client.release();
        process.exit();
    }
}

fixLibrary();
