const { pool } = require('../config/db');

async function runMigration() {
    try {
        console.log('Adding missing columns to hostels table...');
        
        await pool.query(`ALTER TABLE hostels ADD COLUMN IF NOT EXISTS address TEXT;`);
        await pool.query(`ALTER TABLE hostels ADD COLUMN IF NOT EXISTS type VARCHAR(50);`);
        await pool.query(`ALTER TABLE hostels ADD COLUMN IF NOT EXISTS warden_name VARCHAR(255);`);
        await pool.query(`ALTER TABLE hostels ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50);`);
        
        console.log('✅ Migration successful! The hostels table now has all required columns.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        process.exit();
    }
}

runMigration();
