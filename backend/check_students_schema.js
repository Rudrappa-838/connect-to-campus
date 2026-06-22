const { pool } = require('./src/config/db');

pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='students'").then(res => {
    console.log(JSON.stringify(res.rows));
    process.exit(0);
});
