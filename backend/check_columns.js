const { Pool } = require('pg');
require('dotenv').config();

async function checkUsersDataType() {
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'");
        console.log('Data types in public.users:');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (error) {
        console.error('Error listing user data types:', error.message);
    } finally {
        await pool.end();
    }
}

checkUsersDataType();
