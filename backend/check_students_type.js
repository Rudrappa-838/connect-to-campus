const { Pool } = require('pg');
require('dotenv').config();

async function checkStudentsDataType() {
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students'");
        console.log('Data types in public.students:');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (error) {
        console.error('Error listing student data types:', error.message);
    } finally {
        await pool.end();
    }
}

checkStudentsDataType();
