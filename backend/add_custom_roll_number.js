const { pool } = require('./src/config/db');

async function migrate() {
    try {
        console.log('Checking and adding custom_roll_number to students table...');
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS custom_roll_number VARCHAR(50);
        `);
        console.log('✅ Database migration successful: custom_roll_number column verified/added.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
