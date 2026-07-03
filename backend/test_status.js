const { pool } = require('./src/config/db');
pool.query("SELECT name, status, admission_no FROM students WHERE admission_no = 'PRS1427'")
    .then(res => { console.log(res.rows); process.exit(0); })
    .catch(console.error);
