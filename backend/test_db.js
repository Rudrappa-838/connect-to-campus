const { Pool } = require('pg');

const urls = [
    'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', // original
    'postgresql://postgres:Rudrappa%40838@db.rgtbslnmkuuzeauxiylv.supabase.co:5432/postgres', // direct
    'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres', // alternative pooler
];

async function testConnection(url) {
    const pool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const client = await pool.connect();
        console.log(`✅ Success: ${url}`);
        client.release();
    } catch (err) {
        console.log(`❌ Failed: ${url}`);
        console.log(`   Error: ${err.message}`);
    } finally {
        await pool.end();
    }
}

async function run() {
    for (const url of urls) {
        await testConnection(url);
    }
}

run();
