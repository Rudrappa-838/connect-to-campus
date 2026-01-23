const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function relaxConstraints() {
    const client = await pool.connect();
    try {
        console.log('🔓 Starting Constraint Relaxation for Names...');
        await client.query('BEGIN');

        const tables = ['students', 'teachers', 'staff'];

        for (const table of tables) {
            console.log(`Checking table: ${table}...`);

            // 1. Check if first_name exists
            const fnRes = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name=$1 AND column_name='first_name'
            `, [table]);

            if (fnRes.rows.length > 0) {
                console.log(`   - "first_name" exists. Removing NOT NULL constraint...`);
                await client.query(`ALTER TABLE ${table} ALTER COLUMN first_name DROP NOT NULL`);
            }

            // 2. Check if last_name exists
            const lnRes = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name=$1 AND column_name='last_name'
            `, [table]);

            if (lnRes.rows.length > 0) {
                console.log(`   - "last_name" exists. Removing NOT NULL constraint...`);
                await client.query(`ALTER TABLE ${table} ALTER COLUMN last_name DROP NOT NULL`);
            }
        }

        await client.query('COMMIT');
        console.log('🎉 Name constraints relaxed! All forms should work now.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error relaxing constraints:', e);
    } finally {
        client.release();
        pool.end();
    }
}

relaxConstraints();
