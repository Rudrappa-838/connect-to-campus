const { pool } = require('./src/config/db');
pool.query("SELECT * FROM schools").then(res => { console.log(JSON.stringify(res.rows, null, 2)); process.exit(); });
