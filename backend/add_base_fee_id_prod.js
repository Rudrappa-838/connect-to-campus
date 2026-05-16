const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/myproject_prod_db',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Adding base_fee_id column to PROD DB...');
        await pool.query(`
            ALTER TABLE fee_structures 
            ADD COLUMN IF NOT EXISTS base_fee_id INTEGER REFERENCES fee_structures(id) ON DELETE CASCADE;
        `);
        console.log('Successfully added base_fee_id column to PROD DB!');
    } catch (err) {
        console.error('Error adding column to PROD DB:', err);
    } finally {
        await pool.end();
    }
}
run();
