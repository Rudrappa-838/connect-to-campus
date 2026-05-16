const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: 'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Adding base_fee_id column...');
        await pool.query(`
            ALTER TABLE fee_structures 
            ADD COLUMN IF NOT EXISTS base_fee_id INTEGER REFERENCES fee_structures(id) ON DELETE CASCADE;
        `);
        console.log('Successfully added base_fee_id column!');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await pool.end();
    }
}
run();
