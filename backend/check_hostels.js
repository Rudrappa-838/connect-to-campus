const { pool } = require('./src/config/db');
pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'hostels'").then(res => { console.log(JSON.stringify(res.rows, null, 2)); process.exit(); });
