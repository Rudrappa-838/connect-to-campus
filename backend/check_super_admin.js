const { pool } = require('./src/config/db');
pool.query("SELECT email FROM users WHERE role = 'SUPER_ADMIN'")
  .then(res => { console.log("SUPER_ADMINS:", res.rows); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });
