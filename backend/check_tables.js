const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res1 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'teachers'`);
    console.log("TEACHERS:");
    console.table(res1.rows);
    const res2 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff'`);
    console.log("STAFF:");
    console.table(res2.rows);
    pool.end();
}
check();
